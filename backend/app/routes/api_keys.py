"""File 09 — MCP API key management.

Generation + revocation, hashed at rest, never in logs or URLs.
"""
import datetime
import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import func

from app.db import get_session
from app.models.db_models import ApiKey
from app.utils.crypto import generate_api_key, verify_api_key

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api-keys", tags=["api-keys"])


class ApiKeyCreate(BaseModel):
    repo_identifier: str
    name: str = ""


class ApiKeyCreateResponse(BaseModel):
    key: str  # Full key — shown ONCE
    prefix: str
    name: str
    created_at: datetime.datetime


class ApiKeyListItem(BaseModel):
    id: int
    prefix: str
    name: str
    repo_identifier: str
    is_active: bool
    created_at: datetime.datetime
    last_used_at: datetime.datetime | None
    revoked_at: datetime.datetime | None


class ApiKeyRevoke(BaseModel):
    prefix: str


class ApiKeyRevokeResponse(BaseModel):
    ok: bool
    revoked_at: datetime.datetime


@router.post("", response_model=ApiKeyCreateResponse)
async def create_api_key(
    request: ApiKeyCreate,
    session: AsyncSession = Depends(get_session),
):
    """Generate a new MCP API key for a repository.
    The full key is returned ONCE — store it immediately.
    """
    raw_key, prefix, key_hash = generate_api_key()

    api_key = ApiKey(
        user_key="default",
        repo_identifier=request.repo_identifier,
        key_hash=key_hash,
        key_prefix=prefix,
        name=request.name or f"Key {prefix}",
    )
    session.add(api_key)
    await session.commit()
    await session.refresh(api_key)

    logger.info("Created API key %s for repo %s", prefix, request.repo_identifier)

    return ApiKeyCreateResponse(
        key=raw_key,
        prefix=prefix,
        name=api_key.name,
        created_at=api_key.created_at,
    )


@router.get("", response_model=list[ApiKeyListItem])
async def list_api_keys(
    repo_identifier: str | None = None,
    session: AsyncSession = Depends(get_session),
):
    """List all API keys for the user (optionally filtered by repo)."""
    query = select(ApiKey).where(ApiKey.user_key == "default")
    if repo_identifier:
        query = query.where(ApiKey.repo_identifier == repo_identifier)
    query = query.order_by(ApiKey.created_at.desc())

    result = await session.execute(query)
    keys = result.scalars().all()

    return [
        ApiKeyListItem(
            id=k.id,
            prefix=k.key_prefix,
            name=k.name,
            repo_identifier=k.repo_identifier,
            is_active=k.is_active,
            created_at=k.created_at,
            last_used_at=k.last_used_at,
            revoked_at=k.revoked_at,
        )
        for k in keys
    ]


@router.post("/revoke", response_model=ApiKeyRevokeResponse)
async def revoke_api_key(
    request: ApiKeyRevoke,
    session: AsyncSession = Depends(get_session),
):
    """Revoke an API key by its prefix."""
    result = await session.execute(
        select(ApiKey).where(
            ApiKey.user_key == "default",
            ApiKey.key_prefix == request.prefix,
        )
    )
    api_key = result.scalar_one_or_none()

    if not api_key:
        raise HTTPException(status_code=404, detail="API key not found")

    if not api_key.is_active:
        raise HTTPException(status_code=400, detail="API key already revoked")

    api_key.is_active = False
    api_key.revoked_at = datetime.datetime.now(datetime.timezone.utc)
    session.add(api_key)
    await session.commit()

    logger.info("Revoked API key %s", request.prefix)

    return ApiKeyRevokeResponse(ok=True, revoked_at=api_key.revoked_at)


async def validate_api_key(
    session: AsyncSession,
    repo_identifier: str,
    plain_key: str,
) -> ApiKey | None:
    """
    Validate an API key for a repository.
    Returns the ApiKey record if valid and active, None otherwise.
    Updates last_used_at on success.
    """
    result = await session.execute(
        select(ApiKey).where(
            ApiKey.user_key == "default",
            ApiKey.repo_identifier == repo_identifier,
            ApiKey.is_active == True,
        )
    )
    candidates = result.scalars().all()

    for candidate in candidates:
        if verify_api_key(plain_key, candidate.key_hash):
            candidate.last_used_at = datetime.datetime.now(datetime.timezone.utc)
            session.add(candidate)
            await session.commit()
            return candidate

    return None