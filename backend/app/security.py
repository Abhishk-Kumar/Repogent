"""Deploy guard: cross-origin mutating-call protection + /ask rate limiting.

Threat model (proportionate, beta): the frontend is served same-origin by
this backend, so legitimate browser use always carries a matching Origin.
Cross-site drive-by calls (malicious pages POSTing to a deployed backend)
carry a foreign Origin and are rejected unless they present the deploy
secret. Same-origin, loopback, and headerless (curl/MCP/httpx) callers pass
— this is NOT a substitute for real user auth (see BLOCKERS.md); it raises
the bar for browser-based abuse while keeping zero-signup demo working.

Fail-open locally: when DEPLOY_SECRET is unset, everything passes and a
warning is logged at startup.
"""
import logging
import time
from urllib.parse import urlparse

from fastapi import Request
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)

SECRET_HEADER = "X-Deploy-Secret"
SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}

# Mutating paths that must stay open: provider webhooks carry their own
# HMAC verification; OAuth callbacks are plain browser redirects that
# cannot send custom headers.
EXEMPT_PREFIXES = ("/health", "/github/webhook")
EXEMPT_SUFFIXES = ("/callback",)


def _host(value: str) -> str:
    try:
        return (urlparse(value).hostname or "").lower()
    except Exception:
        return ""


def origin_allowed(origin: str | None, server_host: str, site_host: str) -> bool:
    """Same-origin (or no-Origin non-browser caller) is allowed."""
    if not origin:
        return True
    host = _host(origin)
    return host in {server_host.lower(), site_host.lower()}


def is_exempt_path(path: str) -> bool:
    return path.startswith(EXEMPT_PREFIXES) or path.endswith(EXEMPT_SUFFIXES)


class RateLimiter:
    """Fixed-window per-key counter. In-memory: single-instance beta."""

    def __init__(self) -> None:
        self._hits: dict[str, tuple[float, int]] = {}

    def check(self, key: str, limit: int, window_seconds: int, now: float | None = None) -> bool:
        now = time.time() if now is None else now
        start, count = self._hits.get(key, (now, 0))
        if now - start >= window_seconds:
            start, count = now, 0
        count += 1
        self._hits[key] = (start, count)
        return count <= limit


def make_security_middleware(
    *,
    secret: str,
    site_url: str,
    ask_limit_per_min: int = 20,
):
    """Build the ASGI middleware. Empty secret => fail-open (local dev)."""
    site_host = _host(site_url)
    limiter = RateLimiter()
    warned = {"no": False}

    async def security_middleware(request: Request, call_next):
        if not secret:
            return await call_next(request)

        path = request.url.path
        if request.method in SAFE_METHODS or is_exempt_path(path):
            return await call_next(request)

        origin = request.headers.get("origin")
        server_host = request.url.hostname or ""
        if not origin_allowed(origin, server_host, site_host):
            presented = request.headers.get(SECRET_HEADER, "")
            if not presented or presented != secret:
                logger.warning("Blocked cross-origin %s %s", request.method, path)
                return JSONResponse(
                    status_code=403,
                    content={"error": "forbidden", "detail": "Cross-origin mutating calls require the deploy secret."},
                )

        if path == "/ask":
            client = request.client.host if request.client else "unknown"
            if not limiter.check(f"ask:{client}", ask_limit_per_min, 60):
                return JSONResponse(
                    status_code=429,
                    content={"error": "rate_limited", "retryable": True},
                )

        return await call_next(request)

    return security_middleware
