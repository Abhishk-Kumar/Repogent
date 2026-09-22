import hashlib
import hmac
import json
import logging

from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel

from app.config import settings
from app.db import async_session_factory
from app.models.db_models import GitHubConnection, _normalize_repo_identifier

logger = logging.getLogger(__name__)

router = APIRouter()


class ConnectRequest(BaseModel):
    repo_url: str
    installation_id: str
    github_repo_full_name: str


class DisconnectRequest(BaseModel):
    repo_url: str


@router.post("/github/connect")
async def connect_github(request: ConnectRequest):
    repo_identifier = _normalize_repo_identifier(request.repo_url)
    async with async_session_factory() as session:
        from sqlalchemy import select
        existing = await session.execute(
            select(GitHubConnection).where(
                GitHubConnection.repo_identifier == repo_identifier
            )
        )
        existing_row = existing.scalar_one_or_none()
        if existing_row:
            existing_row.installation_id = request.installation_id
            existing_row.github_repo_full_name = request.github_repo_full_name
        else:
            session.add(GitHubConnection(
                repo_identifier=repo_identifier,
                installation_id=request.installation_id,
                github_repo_full_name=request.github_repo_full_name,
            ))
        await session.commit()
    return {"status": "connected"}


@router.post("/github/disconnect")
async def disconnect_github(request: DisconnectRequest):
    repo_identifier = _normalize_repo_identifier(request.repo_url)
    async with async_session_factory() as session:
        from sqlalchemy import select
        existing = await session.execute(
            select(GitHubConnection).where(
                GitHubConnection.repo_identifier == repo_identifier
            )
        )
        existing_row = existing.scalar_one_or_none()
        if existing_row:
            await session.delete(existing_row)
            await session.commit()
    return {"status": "disconnected"}


@router.get("/github/connection/{repo_url:path}")
async def get_connection(repo_url: str):
    repo_identifier = _normalize_repo_identifier(repo_url)
    async with async_session_factory() as session:
        from sqlalchemy import select
        existing = await session.execute(
            select(GitHubConnection).where(
                GitHubConnection.repo_identifier == repo_identifier
            )
        )
        row = existing.scalar_one_or_none()
        if row:
            return {
                "connected": True,
                "installation_id": row.installation_id,
                "github_repo_full_name": row.github_repo_full_name,
            }
    return {"connected": False}


def _verify_webhook_signature(payload: bytes, signature_header: str) -> bool:
    if not settings.github_webhook_secret:
        logger.warning("GITHUB_WEBHOOK_SECRET not set, skipping signature verification")
        return True
    signature = signature_header.replace("sha256=", "")
    expected = hmac.new(
        settings.github_webhook_secret.encode(),
        payload,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(signature, expected)


@router.post("/github/webhook")
async def github_webhook(request: Request):
    payload_bytes = await request.body()
    sig = request.headers.get("X-Hub-Signature-256", "")

    if not _verify_webhook_signature(payload_bytes, sig):
        raise HTTPException(status_code=401, detail="Invalid signature")

    event = request.headers.get("X-GitHub-Event", "")
    payload = json.loads(payload_bytes)

    logger.info("GitHub webhook: event=%s action=%s", event, payload.get("action", ""))

    if event == "push":
        await _handle_push(payload)
    elif event == "pull_request" and payload.get("action") in ("opened", "synchronize"):
        await _handle_pr(payload)

    return {"status": "ok"}


async def _handle_push(payload: dict):
    repo_full_name = payload.get("repository", {}).get("full_name", "")
    logger.info("Push to %s — scan triggered", repo_full_name)


async def _handle_pr(payload: dict):
    repo_full_name = payload.get("repository", {}).get("full_name", "")
    pr_number = payload.get("number", 0)
    logger.info("PR #%d on %s — scan triggered", pr_number, repo_full_name)
