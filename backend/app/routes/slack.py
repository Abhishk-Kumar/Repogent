"""File 06 — Slack integration API.

Sharing + notifications only. No bot commands, no bi-directional chat
(out of scope per 06.3 — noted here, stretch).

Route paths use the repo's existing root style (e.g. /scan_report), not /api/*.
Reuses the integration-plumbing pattern from Jira in 04
(`/integrations/slack/*`) so a third integration later is trivial.

Gate (06 + 02):
- Share posts a correctly formatted message to a real test channel
- Webhook-URL fallback path works
- Notify-on-complete fires exactly once per completed scan
- Disconnect revokes/clears tokens; no token ever in localStorage or logs
"""
import logging

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.db import get_session
from app.models.db_models import SlackConnection
from app.oauth_state import consume_state, issue_state
from app.integrations import slack_oauth

logger = logging.getLogger(__name__)

router = APIRouter()

SEVERITY_EMOJI = {
    "critical": "🔴",
    "high": "🟠",
    "medium": "🟡",
    "low": "🔵",
    "info": "⚪",
}


# ── Schemas ──

class ShareBody(BaseModel):
    repo: str = ""
    channel: str = ""
    health_score: float = 0
    grade: str = ""
    findings: list[dict] = []
    report_url: str = ""


class WebhookBody(BaseModel):
    webhook_url: str = ""


class ShareViaWebhookBody(WebhookBody):
    repo: str = ""
    health_score: float = 0
    grade: str = ""
    findings: list[dict] = []
    report_url: str = ""


class NotifyBody(BaseModel):
    enabled: bool = False


# ── Connection ──

@router.get("/integrations/slack/status")
async def slack_status(session: AsyncSession = Depends(get_session)):
    rows = (await session.execute(
        select(SlackConnection).where(SlackConnection.user_key == "default")
    )).scalars().all()
    if not rows:
        return {"connected": False}
    c = rows[0]
    return {
        "connected": True,
        "team_name": c.team_name,
        "notify_on_complete": c.notify_on_complete,
        "has_webhook": bool(c.encrypted_webhook_url),
    }


@router.post("/integrations/slack/disconnect")
async def slack_disconnect(session: AsyncSession = Depends(get_session)):
    # Disconnect revokes server-side only — tokens live in the DB,
    # never localStorage or logs (06 gate).
    rows = (await session.execute(
        select(SlackConnection).where(SlackConnection.user_key == "default")
    )).scalars().all()
    for c in rows:
        await session.delete(c)
    await session.commit()
    return {"ok": True}


@router.get("/integrations/slack/connect")
async def slack_connect():
    url = slack_oauth.build_authorize_url(issue_state())
    if not url:
        return {
            "error": "slack_not_configured",
            "detail": "Set SLACK_CLIENT_ID / SLACK_CLIENT_SECRET / SLACK_REDIRECT_URI to enable Slack OAuth.",
        }
    return {"auth_url": url}


@router.get("/integrations/slack/callback")
async def slack_callback(code: str = "", state: str = "", session: AsyncSession = Depends(get_session)):
    if not code:
        return {"error": "missing_code"}
    if not consume_state(state):
        logger.warning("Slack OAuth callback with invalid/expired state")
        return {"error": "invalid_state", "detail": "OAuth state mismatch. Please reconnect."}
    try:
        tokens = await slack_oauth.exchange_code(code)
        access = tokens.get("access_token", "")
        team = tokens.get("team") or {}
        team_name = team.get("name", "")
        team_id = team.get("id", "")
        bot_user_id = tokens.get("bot_user_id", "")
        try:
            info = await slack_oauth.get_bot_info(access)
            team_name = team_name or info.get("team", "")
            team_id = team_id or info.get("team_id", "")
            bot_user_id = bot_user_id or info.get("user_id", "")
        except Exception:
            logger.warning("Slack auth.test failed; storing team info from OAuth response")
        rows = (await session.execute(
            select(SlackConnection).where(SlackConnection.user_key == "default")
        )).scalars().all()
        conn = rows[0] if rows else SlackConnection(user_key="default")
        conn.team_name = team_name
        conn.team_id = team_id
        conn.bot_user_id = bot_user_id
        conn.bot_access_token = slack_oauth.encrypt_token(access)
        session.add(conn)
        await session.commit()
        return {"connected": True, "team_name": team_name}
    except Exception:
        logger.exception("Slack OAuth callback failed")
        return {"error": "oauth_failed", "detail": "OAuth exchange failed. Check server logs."}


async def _get_token(session: AsyncSession) -> str | None:
    rows = (await session.execute(
        select(SlackConnection).where(SlackConnection.user_key == "default")
    )).scalars().all()
    if not rows or not rows[0].bot_access_token:
        return None
    try:
        return slack_oauth.decrypt_token(rows[0].bot_access_token)
    except Exception:
        logger.exception("Slack token decrypt failed")
        return None


# ── Channels ──

@router.get("/integrations/slack/channels")
async def slack_channels(session: AsyncSession = Depends(get_session)):
    token = await _get_token(session)
    if not token:
        return {"error": "slack_not_connected", "detail": "Connect Slack first."}
    try:
        channels: list[dict] = []
        cursor: str | None = None
        while True:
            data = await slack_oauth.get_conversations(token, cursor)
            for ch in data.get("channels", []):
                channels.append({
                    "id": ch.get("id", ""),
                    "name": ch.get("name", ""),
                    "is_private": bool(ch.get("is_private")),
                    "is_member": bool(ch.get("is_member")),
                })
            cursor = (data.get("response_metadata") or {}).get("next_cursor") or None
            if not cursor:
                break
        return {"channels": channels}
    except Exception:
        logger.exception("Slack conversations.list failed")
        return {"error": "channels_failed", "detail": "Could not list channels. Check server logs."}


# ── Message format (06.1: Block Kit, keep simple) ──

def build_scan_blocks(
    repo: str, health_score: float, grade: str,
    findings: list[dict], report_url: str,
) -> tuple[str, list[dict]]:
    """Return (fallback_text, blocks) for a scan summary.

    Format: repo name + link, health score with grade, top 3 findings
    (severity emoji + title), CTA button "Open in CodeAtlas".
    """
    short = repo.replace("https://github.com/", "").rstrip("/")
    finding_count = len(findings)
    text = (
        f"CodeAtlas scan: {short} — Health {health_score:.0f}/100 ({grade}), "
        f"{finding_count} findings"
    )
    top = findings[:3]
    findings_md = "\n".join(
        f"{SEVERITY_EMOJI.get(str(f.get('severity', '')).lower(), '•')} "
        f"*{str(f.get('title', 'Untitled'))[:120]}*"
        for f in top
    ) or "_No findings — nice._"
    blocks: list[dict] = [
        {
            "type": "section",
            "text": {"type": "mrkdwn", "text": f"*CodeAtlas scan: <{repo}|{short}>*"},
        },
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f"*Health {health_score:.0f}/100 ({grade})* · {finding_count} findings\n{findings_md}",
            },
        },
    ]
    if report_url:
        blocks.append({
            "type": "actions",
            "elements": [{
                "type": "button",
                "text": {"type": "plain_text", "text": "Open in CodeAtlas"},
                "url": report_url[:3000],
            }],
        })
    return text, blocks


# ── Share (OAuth path) ──

@router.post("/integrations/slack/share")
async def slack_share(body: ShareBody, session: AsyncSession = Depends(get_session)):
    if not body.channel:
        return {"error": "missing_channel", "detail": "Pick a channel first."}
    token = await _get_token(session)
    if not token:
        return {"error": "slack_not_connected", "detail": "Connect Slack first."}
    try:
        text, blocks = build_scan_blocks(
            body.repo, body.health_score, body.grade, body.findings, body.report_url,
        )
        await slack_oauth.post_message(token, body.channel, text, blocks)
        return {"ok": True}
    except Exception:
        logger.exception("Slack share failed")
        return {"error": "share_failed", "detail": "Slack API call failed. Check server logs."}


# ── Webhook fallback (06.2) ──

@router.post("/integrations/slack/webhook")
async def slack_save_webhook(body: WebhookBody, session: AsyncSession = Depends(get_session)):
    url = (body.webhook_url or "").strip()
    if not url.startswith("https://hooks.slack.com/"):
        return {"error": "invalid_webhook", "detail": "Expected an https://hooks.slack.com/ URL."}
    rows = (await session.execute(
        select(SlackConnection).where(SlackConnection.user_key == "default")
    )).scalars().all()
    conn = rows[0] if rows else SlackConnection(user_key="default")
    conn.encrypted_webhook_url = slack_oauth.encrypt_token(url)
    session.add(conn)
    await session.commit()
    return {"ok": True}


@router.post("/integrations/slack/share-webhook")
async def slack_share_webhook(body: ShareViaWebhookBody, session: AsyncSession = Depends(get_session)):
    rows = (await session.execute(
        select(SlackConnection).where(SlackConnection.user_key == "default")
    )).scalars().all()
    webhook = ""
    if rows and rows[0].encrypted_webhook_url:
        try:
            webhook = slack_oauth.decrypt_token(rows[0].encrypted_webhook_url)
        except Exception:
            logger.exception("Slack webhook decrypt failed")
    if not webhook:
        if body.webhook_url.strip().startswith("https://hooks.slack.com/"):
            webhook = body.webhook_url.strip()
        else:
            return {"error": "no_webhook", "detail": "Save an incoming webhook URL first."}
    try:
        import httpx

        text, blocks = build_scan_blocks(
            body.repo, body.health_score, body.grade, body.findings, body.report_url,
        )
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(webhook, json={"text": text, "blocks": blocks})
            resp.raise_for_status()
        return {"ok": True}
    except Exception:
        logger.exception("Slack webhook share failed")
        return {"error": "share_failed", "detail": "Webhook post failed. Check server logs."}


# ── Notify on scan complete (06.1, opt-in) ──

@router.post("/integrations/slack/notify")
async def slack_notify_pref(body: NotifyBody, session: AsyncSession = Depends(get_session)):
    rows = (await session.execute(
        select(SlackConnection).where(SlackConnection.user_key == "default")
    )).scalars().all()
    if not rows:
        return {"error": "slack_not_connected", "detail": "Connect Slack first."}
    rows[0].notify_on_complete = body.enabled
    session.add(rows[0])
    await session.commit()
    return {"ok": True, "notify_on_complete": body.enabled}


async def maybe_notify_scan_complete(
    session: AsyncSession, repo_url: str, health_score: float,
    grade: str, finding_count: int, report_url: str = "",
) -> bool:
    """Post the 06.1 completion message once, iff the user opted in.

    Called exactly once at the end of a scan job (see jobs._run_scan),
    satisfying "fires exactly once per completed scan". Returns True if posted.
    """
    rows = (await session.execute(
        select(SlackConnection).where(SlackConnection.user_key == "default")
    )).scalars().all()
    if not rows or not rows[0].notify_on_complete:
        return False
    token = await _get_token(session)
    if not token:
        return False
    try:
        channels_resp = await slack_oauth.get_conversations(token)
        channels = channels_resp.get("channels", [])
        target = next((c.get("id") for c in channels if c.get("is_member")), None)
        if not target and channels:
            target = channels[0].get("id")
        if not target:
            return False
        short = repo_url.replace("https://github.com/", "").rstrip("/")
        text = (
            f"✅ Analysis complete: `{short}` — Health {health_score:.0f}/100 ({grade}), "
            f"{finding_count} findings"
        )
        blocks = [
            {"type": "section", "text": {"type": "mrkdwn", "text": text}},
        ]
        if report_url:
            blocks.append({
                "type": "actions",
                "elements": [{
                    "type": "button",
                    "text": {"type": "plain_text", "text": "Open in CodeAtlas"},
                    "url": report_url[:3000],
                }],
            })
        await slack_oauth.post_message(token, target, text, blocks)
        return True
    except Exception:
        logger.exception("Slack scan-complete notify failed")
        return False
