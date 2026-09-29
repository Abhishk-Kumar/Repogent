"""Deploy-guard tests: origin policy + /ask rate limiting (C3)."""
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.testclient import TestClient
from starlette.middleware.base import BaseHTTPMiddleware

from app.security import RateLimiter, is_exempt_path, make_security_middleware, origin_allowed


def _app(**kwargs):
    app = FastAPI()

    @app.post("/tickets")
    async def _mutating():
        return {"ok": True}

    @app.get("/metrics")
    async def _safe():
        return {"ok": True}

    @app.post("/ask")
    async def _ask():
        return {"answer": "x"}

    @app.post("/github/webhook")
    async def _hook():
        return {"ok": True}

    @app.get("/integrations/slack/callback")
    async def _cb():
        return {"ok": True}

    kwargs.setdefault("secret", "s3cr3t")
    kwargs.setdefault("site_url", "https://example.com")
    app.add_middleware(BaseHTTPMiddleware, dispatch=make_security_middleware(**kwargs))
    return TestClient(app)


def test_same_origin_mutating_allowed():
    c = _app()
    r = c.post("/tickets", headers={"origin": "http://testserver"})
    assert r.status_code == 200


def test_cross_origin_without_secret_blocked():
    c = _app()
    r = c.post("/tickets", headers={"origin": "https://evil.test"})
    assert r.status_code == 403
    assert r.json()["error"] == "forbidden"


def test_cross_origin_with_secret_allowed():
    c = _app()
    r = c.post(
        "/tickets",
        headers={"origin": "https://evil.test", "X-Deploy-Secret": "s3cr3t"},
    )
    assert r.status_code == 200


def test_no_origin_allowed_documented():
    # Headerless callers (curl, MCP server, httpx) cannot be told apart;
    # allowed by design — documented, not auth (see BLOCKERS.md).
    c = _app()
    assert c.post("/tickets").status_code == 200


def test_gets_and_exempts_untouched():
    c = _app()
    assert c.get("/metrics", headers={"origin": "https://evil.test"}).status_code == 200
    assert c.post("/github/webhook", headers={"origin": "https://evil.test"}).status_code == 200
    assert c.get("/integrations/slack/callback", headers={"origin": "https://evil.test"}).status_code == 200


def test_fail_open_without_secret(caplog):
    c = _app(secret="")
    r = c.post("/tickets", headers={"origin": "https://evil.test"})
    assert r.status_code == 200


def test_ask_rate_limited():
    c = _app(ask_limit_per_min=3)
    codes = [c.post("/ask", headers={"origin": "http://testserver"}).status_code for _ in range(5)]
    assert codes[:3] == [200, 200, 200]
    assert codes[3] == 429
    assert codes[4] == 429
    assert c.post("/ask", headers={"origin": "http://testserver"}).json()["error"] == "rate_limited"


def test_origin_allowed_unit():
    assert origin_allowed(None, "a.com", "b.com") is True
    assert origin_allowed("https://a.com", "a.com", "b.com") is True
    assert origin_allowed("https://b.com/x", "a.com", "b.com") is True
    assert origin_allowed("https://evil.com", "a.com", "b.com") is False
    assert origin_allowed("not a url", "a.com", "b.com") is False


def test_exempt_paths_unit():
    assert is_exempt_path("/health") is True
    assert is_exempt_path("/health/llm") is True
    assert is_exempt_path("/github/webhook") is True
    assert is_exempt_path("/integrations/jira/callback") is True
    assert is_exempt_path("/tickets") is False
    assert is_exempt_path("/ask") is False


def test_rate_limiter_window_resets():
    rl = RateLimiter()
    assert rl.check("k", 2, 60, now=100.0) is True
    assert rl.check("k", 2, 60, now=101.0) is True
    assert rl.check("k", 2, 60, now=102.0) is False
    assert rl.check("k", 2, 60, now=200.0) is True
