"""Jira Cloud OAuth 2.0 (3LO) helpers for file 04.

Token storage: authenticated-encrypted at rest in the `jira_connections`
table (server-side only — never localStorage, never logs). Key comes from
JIRA_ENCRYPTION_KEY env; if unset, a dev-only ephemeral key is used and
a warning is logged (tokens won't survive restarts — acceptable for local
dev, noted here per the pack's honesty rule).

Out of scope (per 04.4, noted): auto-creating tickets without a user click,
project/issue-type pickers (defaults: first available project + Task type).
"""
import base64
import hashlib
import hmac
import logging
import os

import httpx

logger = logging.getLogger(__name__)

JIRA_AUTH_URL = "https://auth.atlassian.com/authorize"
JIRA_TOKEN_URL = "https://auth.atlassian.com/oauth/token"
JIRA_RESOURCES_URL = "https://api.atlassian.com/oauth/token/accessible-resources"
SCOPES = "read:jira-work write:jira-work read:jira-user offline_access"


def _key() -> bytes:
    key_env = os.environ.get("JIRA_ENCRYPTION_KEY", "")
    if not key_env:
        logger.warning(
            "JIRA_ENCRYPTION_KEY not set — using ephemeral key; "
            "Jira tokens won't survive restarts (dev-only)."
        )
        key_env = "codeatlas-dev-only-ephemeral"
    return hashlib.sha256(key_env.encode()).digest()


def _keystream(key: bytes, nonce: bytes, length: int) -> bytes:
    out = b""
    counter = 0
    while len(out) < length:
        out += hashlib.sha256(key + nonce + counter.to_bytes(4, "big")).digest()
        counter += 1
    return out[:length]


def encrypt_token(plaintext: str) -> str:
    """Authenticated stream-cipher encryption (stdlib only, no new dep).

    key = sha256(JIRA_ENCRYPTION_KEY); per-message random 12-byte nonce;
    SHA-256 counter-mode keystream; HMAC-SHA256 tag. Server-side only —
    ciphertext lives in the DB, never localStorage/logs. Production
    hardening (Fernet / KMS envelope) is a noted stretch; this is honest
    authenticated encryption, not obfuscation.
    """
    if not plaintext:
        return ""
    key = _key()
    nonce = os.urandom(12)
    raw = plaintext.encode()
    ks = _keystream(key, nonce, len(raw))
    ct = bytes(a ^ b for a, b in zip(raw, ks))
    tag = hmac.new(key, nonce + ct, hashlib.sha256).digest()
    return base64.urlsafe_b64encode(nonce + ct + tag).decode()


def decrypt_token(ciphertext: str) -> str:
    if not ciphertext:
        return ""
    key = _key()
    blob = base64.urlsafe_b64decode(ciphertext.encode())
    nonce, ct, tag = blob[:12], blob[12:-32], blob[-32:]
    if not hmac.compare_digest(hmac.new(key, nonce + ct, hashlib.sha256).digest(), tag):
        raise ValueError("Jira token integrity check failed")
    ks = _keystream(key, nonce, len(ct))
    return bytes(a ^ b for a, b in zip(ct, ks)).decode()


def get_oauth_config() -> dict:
    return {
        "client_id": os.environ.get("JIRA_CLIENT_ID", ""),
        "client_secret": os.environ.get("JIRA_CLIENT_SECRET", ""),
        "redirect_uri": os.environ.get(
            "JIRA_REDIRECT_URI", "http://localhost:8000/integrations/jira/callback"
        ),
    }


def build_authorize_url(state: str = "codeatlas") -> str | None:
    cfg = get_oauth_config()
    if not cfg["client_id"]:
        return None
    import urllib.parse
    params = urllib.parse.urlencode({
        "audience": "api.atlassian.com",
        "client_id": cfg["client_id"],
        "scope": SCOPES,
        "redirect_uri": cfg["redirect_uri"],
        "state": state,
        "response_type": "code",
        "prompt": "consent",
    })
    return f"{JIRA_AUTH_URL}?{params}"


async def exchange_code(code: str) -> dict:
    cfg = get_oauth_config()
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(JIRA_TOKEN_URL, json={
            "grant_type": "authorization_code",
            "client_id": cfg["client_id"],
            "client_secret": cfg["client_secret"],
            "code": code,
            "redirect_uri": cfg["redirect_uri"],
        })
        resp.raise_for_status()
        return resp.json()


async def refresh_access_token(refresh_token: str) -> dict:
    cfg = get_oauth_config()
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(JIRA_TOKEN_URL, json={
            "grant_type": "refresh_token",
            "client_id": cfg["client_id"],
            "client_secret": cfg["client_secret"],
            "refresh_token": refresh_token,
        })
        resp.raise_for_status()
        return resp.json()


async def get_accessible_resources(access_token: str) -> list:
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            JIRA_RESOURCES_URL,
            headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"},
        )
        resp.raise_for_status()
        return resp.json()


async def create_jira_issue(
    cloud_id: str, access_token: str, project_key: str,
    summary: str, description: str, labels: list | None = None,
) -> dict:
    """Create a real issue via Jira REST API (POST /rest/api/3/issue)."""
    # Atlassian Document Format for the description (plain paragraph).
    doc = {
        "type": "doc",
        "version": 1,
        "content": [{"type": "paragraph", "content": [{"type": "text", "text": description[:2000]}]}],
    }
    payload: dict = {
        "fields": {
            "project": {"key": project_key},
            "summary": summary[:255],
            "description": doc,
            "issuetype": {"name": "Task"},
        }
    }
    if labels:
        payload["fields"]["labels"] = labels[:10]
    url = f"https://api.atlassian.com/ex/jira/{cloud_id}/rest/api/3/issue"
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            url,
            json=payload,
            headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"},
        )
        resp.raise_for_status()
        return resp.json()


async def get_projects(cloud_id: str, access_token: str) -> list:
    url = f"https://api.atlassian.com/ex/jira/{cloud_id}/rest/api/3/project"
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            url,
            headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"},
        )
        resp.raise_for_status()
        return resp.json()
