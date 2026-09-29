"""File 04 — Ticket system API.

In-app ticket queue is the source of truth (works with zero integrations).
Jira Cloud OAuth 2.0 (3LO) pushes tickets to the *user's own* Jira site.
Linear follows the same pattern later (stretch — code structured for it).

Route paths use the repo's existing root style (e.g. /scan_report), not /api/*.

Not in scope (04.4): auto-creating tickets without a user click;
project/issue-type pickers (defaults: first available project + Task).
"""
import datetime
import logging
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.db import get_session
from app.models.db_models import Ticket, JiraConnection
from app.oauth_state import consume_state, issue_state
from app.utils.normalize import get_repo_hash
from app.integrations import jira_oauth

logger = logging.getLogger(__name__)

router = APIRouter()

TICKET_ELIGIBLE = {"critical", "high", "medium"}
BULK_PRESELECTED = {"critical", "high"}


# ── Schemas ──

class TicketCreate(BaseModel):
    repo: str = ""
    title: str
    description: str = ""
    severity: str = "medium"
    source_finding_id: str = ""


class TicketOut(BaseModel):
    id: int
    repo: str
    title: str
    description: str
    severity: str
    source_finding_id: str
    status: str
    jira_issue_key: Optional[str] = None
    jira_url: Optional[str] = None
    created_at: str


def _to_out(t: Ticket) -> TicketOut:
    return TicketOut(
        id=t.id or 0,
        repo=t.repo_url,
        title=t.title,
        description=t.description,
        severity=t.severity,
        source_finding_id=t.source_finding_id,
        status=t.status,
        jira_issue_key=t.jira_issue_key,
        jira_url=t.jira_url,
        created_at=t.created_at.isoformat() if t.created_at else "",
    )


# ── Ticket CRUD ──

@router.post("/tickets")
async def create_ticket(body: TicketCreate, session: AsyncSession = Depends(get_session)):
    # NOTE: no response_model — error contract returns {error,...} dicts.
    sev = body.severity.lower()
    if sev not in {"critical", "high", "medium", "low", "info"}:
        sev = "medium"
    if sev in {"low", "info"}:
        return {"error": "ticket_not_eligible", "detail": "Low/Info findings are not ticket-eligible"}
    # Idempotency: same finding + repo returns the existing ticket.
    if body.source_finding_id:
        existing = await session.execute(
            select(Ticket).where(
                Ticket.repo_identifier == get_repo_hash(body.repo),
                Ticket.source_finding_id == body.source_finding_id,
            )
        )
        row = existing.scalars().first()
        if row:
            return _to_out(row)
    t = Ticket(
        repo_identifier=get_repo_hash(body.repo),
        repo_url=body.repo,
        title=body.title[:512],
        description=body.description,
        severity=sev,
        source_finding_id=body.source_finding_id,
        status="open",
    )
    session.add(t)
    await session.commit()
    await session.refresh(t)
    return _to_out(t)


class TicketBulkIssue(BaseModel):
    title: str
    description: str = ""
    severity: str = "medium"
    source_finding_id: str = ""


class TicketBulkCreate(BaseModel):
    repo: str = ""
    issues: list[TicketBulkIssue] = []


@router.post("/tickets/bulk")
async def create_tickets_bulk(body: TicketBulkCreate, session: AsyncSession = Depends(get_session)):
    """Create many tickets in one request + one commit (replaces the
    client-side N+1 loop). Same eligibility + idempotency rules as single
    create; per-item outcomes reported so partial success is visible."""
    repo_hash = get_repo_hash(body.repo)
    created: list[TicketOut] = []
    skipped: list[dict] = []
    seen_ids: set[str] = set()
    for issue in body.issues:
        sev = (issue.severity or "medium").lower()
        if sev not in {"critical", "high", "medium", "low", "info"}:
            sev = "medium"
        if sev in {"low", "info"}:
            skipped.append({"source_finding_id": issue.source_finding_id, "reason": "ticket_not_eligible"})
            continue
        if not issue.source_finding_id or issue.source_finding_id in seen_ids:
            if issue.source_finding_id:
                seen_ids.add(issue.source_finding_id)
                skipped.append({"source_finding_id": issue.source_finding_id, "reason": "duplicate_in_batch"})
            continue
        seen_ids.add(issue.source_finding_id)
        existing = await session.execute(
            select(Ticket).where(
                Ticket.repo_identifier == repo_hash,
                Ticket.source_finding_id == issue.source_finding_id,
            )
        )
        row = existing.scalars().first()
        if row:
            created.append(_to_out(row))
            continue
        t = Ticket(
            repo_identifier=repo_hash,
            repo_url=body.repo,
            title=issue.title[:512],
            description=issue.description,
            severity=sev,
            source_finding_id=issue.source_finding_id,
            status="open",
        )
        session.add(t)
        created.append(t)
    await session.commit()
    out: list[TicketOut] = []
    for t in created:
        if isinstance(t, TicketOut):
            out.append(t)
        else:
            await session.refresh(t)
            out.append(_to_out(t))
    return {"created": out, "skipped": skipped, "count": len(out)}


@router.get("/tickets")
async def list_tickets(
    repo: str = Query(default=""),
    session: AsyncSession = Depends(get_session),
):
    q = select(Ticket).order_by(Ticket.created_at.desc())
    if repo:
        q = q.where(Ticket.repo_identifier == get_repo_hash(repo))
    rows = (await session.execute(q)).scalars().all()
    return [_to_out(t) for t in rows]


@router.delete("/tickets/{ticket_id}")
async def delete_ticket(ticket_id: int, session: AsyncSession = Depends(get_session)):
    t = await session.get(Ticket, ticket_id)
    if not t:
        return {"error": "not_found"}
    await session.delete(t)
    await session.commit()
    return {"ok": True}


# ── Jira integration ──

@router.get("/integrations/jira/status")
async def jira_status(session: AsyncSession = Depends(get_session)):
    rows = (await session.execute(
        select(JiraConnection).where(JiraConnection.user_key == "default")
    )).scalars().all()
    if not rows:
        return {"connected": False}
    c = rows[0]
    return {"connected": True, "site_name": c.site_name, "site_url": c.site_url}


@router.post("/integrations/jira/disconnect")
async def jira_disconnect(session: AsyncSession = Depends(get_session)):
    rows = (await session.execute(
        select(JiraConnection).where(JiraConnection.user_key == "default")
    )).scalars().all()
    for c in rows:
        await session.delete(c)
    await session.commit()
    return {"ok": True}


@router.get("/integrations/jira/connect")
async def jira_connect():
    url = jira_oauth.build_authorize_url(issue_state())
    if not url:
        return {
            "error": "jira_not_configured",
            "detail": "Set JIRA_CLIENT_ID / JIRA_CLIENT_SECRET / JIRA_REDIRECT_URI to enable Jira OAuth.",
        }
    return {"auth_url": url}


@router.get("/integrations/jira/callback")
async def jira_callback(code: str = "", state: str = "", session: AsyncSession = Depends(get_session)):
    if not code:
        return {"error": "missing_code"}
    if not consume_state(state):
        logger.warning("Jira OAuth callback with invalid/expired state")
        return {"error": "invalid_state", "detail": "OAuth state mismatch. Please reconnect."}
    try:
        tokens = await jira_oauth.exchange_code(code)
        access = tokens.get("access_token", "")
        refresh = tokens.get("refresh_token", "")
        resources = await jira_oauth.get_accessible_resources(access)
        if not resources:
            return {"error": "no_sites", "detail": "No Jira sites accessible to this user."}
        site = resources[0]
        cloud_id = site.get("id", "")
        site_url = site.get("url", "")
        site_name = site.get("name", "")
        expires_in = int(tokens.get("expires_in", 3600))
        expires_at = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(seconds=expires_in)
        rows = (await session.execute(
            select(JiraConnection).where(JiraConnection.user_key == "default")
        )).scalars().all()
        conn = rows[0] if rows else JiraConnection(user_key="default")
        conn.site_url = f"{site_url}|{cloud_id}"
        conn.site_name = site_name
        conn.encrypted_access_token = jira_oauth.encrypt_token(access)
        conn.encrypted_refresh_token = jira_oauth.encrypt_token(refresh)
        conn.expires_at = expires_at
        session.add(conn)
        await session.commit()
        return {"connected": True, "site_name": site_name}
    except Exception as e:
        logger.exception("Jira OAuth callback failed")
        return {"error": "oauth_failed", "detail": "OAuth exchange failed. Check server logs."}


async def _get_valid_token(session: AsyncSession) -> tuple[str, str] | tuple[None, None]:
    """Return (access_token, cloud_id), refreshing if expired."""
    rows = (await session.execute(
        select(JiraConnection).where(JiraConnection.user_key == "default")
    )).scalars().all()
    if not rows:
        return None, None
    conn = rows[0]
    parts = (conn.site_url or "").split("|")
    cloud_id = parts[1] if len(parts) > 1 else parts[0]
    now = datetime.datetime.now(datetime.timezone.utc)
    exp = conn.expires_at
    if exp and exp.tzinfo is None:
        exp = exp.replace(tzinfo=datetime.timezone.utc)
    if exp and now >= exp:
        try:
            refresh = jira_oauth.decrypt_token(conn.encrypted_refresh_token)
            tokens = await jira_oauth.refresh_access_token(refresh)
            access = tokens.get("access_token", "")
            conn.encrypted_access_token = jira_oauth.encrypt_token(access)
            if tokens.get("refresh_token"):
                conn.encrypted_refresh_token = jira_oauth.encrypt_token(tokens["refresh_token"])
            expires_in = int(tokens.get("expires_in", 3600))
            conn.expires_at = now + datetime.timedelta(seconds=expires_in)
            session.add(conn)
            await session.commit()
        except Exception:
            logger.exception("Jira token refresh failed")
            return None, None
    else:
        access = jira_oauth.decrypt_token(conn.encrypted_access_token)
    return access, cloud_id


@router.post("/tickets/{ticket_id}/push-jira")
async def push_ticket_to_jira(ticket_id: int, session: AsyncSession = Depends(get_session)):
    t = await session.get(Ticket, ticket_id)
    if not t:
        return {"error": "not_found"}
    access, cloud_id = await _get_valid_token(session)
    if not access:
        return {"error": "jira_not_connected", "detail": "Connect Jira first."}
    try:
        projects = await jira_oauth.get_projects(cloud_id, access)
        if not projects:
            return {"error": "no_projects", "detail": "No Jira projects found on this site."}
        project_key = projects[0].get("key", "")
        result = await jira_oauth.create_jira_issue(
            cloud_id, access, project_key,
            summary=t.title,
            description=f"{t.description}\n\nRepo: {t.repo_url}\nSeverity: {t.severity}\nSource: CodeAtlas scan finding {t.source_finding_id}",
            labels=["codeatlas", f"severity-{t.severity}"],
        )
        key = result.get("key", "")
        # Resolve the site browse URL from the stored site_url.
        rows = (await session.execute(
            select(JiraConnection).where(JiraConnection.user_key == "default")
        )).scalars().all()
        base = (rows[0].site_url.split("|")[0] if rows else "").rstrip("/")
        t.jira_issue_key = key
        t.jira_url = f"{base}/browse/{key}" if base else ""
        t.status = "pushed"
        session.add(t)
        await session.commit()
        return {"ok": True, "issue_key": key, "issue_url": t.jira_url}
    except Exception:
        logger.exception("Push to Jira failed")
        return {"error": "push_failed", "detail": "Jira API call failed. Check server logs."}
