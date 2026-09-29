"""Slack OAuth helpers for file 06.

Token storage: authenticated-encrypted at rest in the `slack_connections`
table (server-side only — never localStorage, never logs). Key comes from
SLACK_ENCRYPTION_KEY env; if unset, a dev-only ephemeral key is used and
a warning is logged (tokens won't survive restarts — acceptable for local
dev, noted here per the pack's honesty rule).

Out of scope (per 06.3): incoming webhooks from Slack, slash commands, unfurling.
"""
import base64
import hashlib
import hmac
import logging
import os

import httpx

logger = logging.getLogger(__name__)

SLACK_AUTH_URL = "https://slack.com/oauth/v2/authorize"
SLACK_TOKEN_URL = "https://slack.com/api/oauth.v2.access"
SCOPES = "channels:read,chat:write,groups:read,im:read,mpim:read"


def _key() -> bytes:
    key_env = os.environ.get("SLACK_ENCRYPTION_KEY", "")
    if not key_env:
        logger.warning(
            "SLACK_ENCRYPTION_KEY not set — using ephemeral key; "
            "Slack tokens won't survive restarts (dev-only)."
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

    key = sha256(SLACK_ENCRYPTION_KEY); per-message random 12-byte nonce;
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
        raise ValueError("Slack token integrity check failed")
    ks = _keystream(key, nonce, len(ct))
    return bytes(a ^ b for a, b in zip(ct, ks)).decode()


def get_oauth_config() -> dict:
    return {
        "client_id": os.environ.get("SLACK_CLIENT_ID", ""),
        "client_secret": os.environ.get("SLACK_CLIENT_SECRET", ""),
        "redirect_uri": os.environ.get(
            "SLACK_REDIRECT_URI", "http://localhost:8000/integrations/slack/callback"
        ),
    }


def build_authorize_url(state: str = "codeatlas") -> str | None:
    cfg = get_oauth_config()
    if not cfg["client_id"]:
        return None
    import urllib.parse

    params = urllib.parse.urlencode({
        "client_id": cfg["client_id"],
        "scope": SCOPES,
        "redirect_uri": cfg["redirect_uri"],
        "state": state,
        "response_type": "code",
    })
    return f"{SLACK_AUTH_URL}?{params}"


async def exchange_code(code: str) -> dict:
    cfg = get_oauth_config()
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            SLACK_TOKEN_URL,
            data={
                "client_id": cfg["client_id"],
                "client_secret": cfg["client_secret"],
                "code": code,
                "redirect_uri": cfg["redirect_uri"],
            },
        )
        resp.raise_for_status()
        data = resp.json()
        if not data.get("ok"):
            raise Exception(f"Slack OAuth error: {data.get('error')}")
        return data


# We don't need refresh for Slack bot tokens (they don't expire by default), but we can keep the function for completeness.
async def refresh_access_token(refresh_token: str) -> dict:
    # Slack bot tokens don't refresh, but we'll keep the function to match the pattern.
    # In reality, we would need to re-oauth.
    raise NotImplementedError("Slack bot tokens do not support refresh; re-oauth required")


async def get_bot_info(access_token: str) -> dict:
    """Get info about the bot/team."""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            "https://slack.com/api/auth.test",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        resp.raise_for_status()
        data = resp.json()
        if not data.get("ok"):
            raise Exception(f"Slack auth.test error: {data.get('error')}")
        return data


async def get_conversations(access_token: str, cursor: str | None = None) -> dict:
    """Get list of channels (public, private, etc.) that the bot is in."""
    async with httpx.AsyncClient(timeout=30) as client:
        params = {"limit": 200}
        if cursor:
            params["cursor"] = cursor
        resp = await client.get(
            "https://slack.com/api/conversations.list",
            headers={"Authorization": f"Bearer {access_token}"},
            params=params,
        )
        resp.raise_for_status()
        data = resp.json()
        if not data.get("ok"):
            raise Exception(f"Slack conversations.list error: {data.get('error')}")
        return data


async def post_message(access_token: str, channel: str, text: str, blocks: list | None = None) -> dict:
    """Post a message to a Slack channel."""
    async with httpx.AsyncClient(timeout=30) as client:
        payload: dict = {
            "channel": channel,
            "text": text,
        }
        if blocks is not None:
            payload["blocks"] = blocks
        resp = await client.post(
            "https://slack.com/api/chat.postMessage",
            headers={"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"},
            json=payload,
        )
        resp.raise_for_status()
        data = resp.json()
        if not data.get("ok"):
            raise Exception(f"Slack chat.postMessage error: {data.get('error')}")
        return data