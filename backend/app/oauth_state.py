"""Per-request OAuth `state` (CSRF protection for Jira/Slack connect flows).

Random single-use states with a short TTL, validated in the OAuth
callbacks. In-memory: correct for the single-instance beta deploy; a
multi-instance deployment needs a shared store (noted, see BLOCKERS.md).
States are never logged.
"""
import logging
import secrets
import time

logger = logging.getLogger(__name__)

DEFAULT_TTL_SECONDS = 600

_store: dict[str, float] = {}


def issue_state(ttl_seconds: int = DEFAULT_TTL_SECONDS) -> str:
    _purge()
    state = secrets.token_urlsafe(24)
    _store[state] = time.time() + ttl_seconds
    return state


def consume_state(state: str) -> bool:
    """Single-use validation. Returns True iff the state is live."""
    _purge()
    expires = _store.pop(state, None)
    if expires is None:
        return False
    return expires > time.time()


def _purge(now: float | None = None) -> None:
    now = time.time() if now is None else now
    for key in [k for k, exp in _store.items() if exp <= now]:
        del _store[key]
