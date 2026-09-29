"""OAuth state tests (CSRF protection for Jira/Slack connect flows)."""
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app import oauth_state
from app.oauth_state import consume_state, issue_state


def test_issue_unique():
    assert issue_state() != issue_state()


def test_consume_single_use():
    s = issue_state()
    assert consume_state(s) is True
    assert consume_state(s) is False


def test_consume_unknown_rejected():
    assert consume_state("nope-not-issued") is False
    assert consume_state("") is False


def test_consume_expired_rejected():
    s = issue_state(ttl_seconds=-1)
    assert consume_state(s) is False


def test_callbacks_reject_bad_state():
    from app.routes.slack import router as slack_router
    from app.routes.tickets import router as tickets_router

    app = FastAPI()
    app.include_router(slack_router)
    app.include_router(tickets_router)
    with TestClient(app) as c:
        r = c.get("/integrations/slack/callback", params={"code": "abc", "state": "bogus"})
        assert r.json()["error"] == "invalid_state"
        r = c.get("/integrations/jira/callback", params={"code": "abc", "state": "bogus"})
        assert r.json()["error"] == "invalid_state"
        r = c.get("/integrations/slack/callback", params={"code": "abc"})
        assert r.json()["error"] == "invalid_state"


def test_callbacks_accept_issued_state(monkeypatch):
    import app.routes.slack as slack_mod
    import app.routes.tickets as tickets_mod

    async def _boom(code):
        raise RuntimeError("exchange must not run on bad state")

    # Issued-but-wrong-path state still validates; exchange would run, so
    # stub exchange to prove the gate passed without network.
    async def _fake_exchange(code):
        return {"access_token": "x", "team": {"name": "t", "id": "i"}, "bot_user_id": "b"}

    async def _fake_bot_info(access):
        return {"team": "t", "team_id": "i", "user_id": "b"}

    monkeypatch.setattr("app.integrations.slack_oauth.exchange_code", _fake_exchange)
    monkeypatch.setattr("app.integrations.slack_oauth.get_bot_info", _fake_bot_info)

    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
    from sqlmodel import SQLModel
    import app.models.db_models  # noqa: F401
    import asyncio
    import tempfile, os

    tmp = tempfile.mkdtemp()
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp}/t.db")
    factory = async_sessionmaker(engine, expire_on_commit=False)

    async def _init():
        async with engine.begin() as conn:
            await conn.run_sync(SQLModel.metadata.create_all)

    asyncio.run(_init())

    async def _session():
        async with factory() as s:
            yield s

    from fastapi import FastAPI as _F
    from fastapi.testclient import TestClient as _T
    from app.db import get_session

    app = _F()
    app.include_router(slack_mod.router)
    app.dependency_overrides[get_session] = _session
    with _T(app) as c:
        s = oauth_state.issue_state()
        r = c.get("/integrations/slack/callback", params={"code": "abc", "state": s})
        assert r.json() == {"connected": True, "team_name": "t"}
        # Single use: replay rejected
        r = c.get("/integrations/slack/callback", params={"code": "abc", "state": s})
        assert r.json()["error"] == "invalid_state"
