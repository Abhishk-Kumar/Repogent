"""11.1 — API contract tests (03.1 chat, 04 tickets, 06 slack).

All external calls mocked; database isolated to a tmp SQLite file per
test (the real `data/codeatlas.db` is never touched). Run:
pytest backend/tests
"""
import asyncio
from unittest.mock import AsyncMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlmodel import SQLModel

import app.models.db_models  # noqa: F401 — register tables
from app.db import get_session
from app.models.db_models import JiraConnection
from app.routes import onboard as onboard_mod
from app.routes import slack as slack_mod
from app.routes import tickets as tickets_mod
from app.routes.integration import router as integration_router
from app.routes.onboard import router as onboard_router
from app.routes.slack import router as slack_router
from app.routes.tickets import router as tickets_router
from app.utils.normalize import normalize_repo_url

REPO = "https://github.com/acme/demo"


@pytest.fixture()
def client(tmp_path, monkeypatch):
    db_path = tmp_path / "test.db"
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}")
    factory = async_sessionmaker(engine, expire_on_commit=False)

    async def _init():
        async with engine.begin() as conn:
            await conn.run_sync(SQLModel.metadata.create_all)

    asyncio.run(_init())

    async def _test_session():
        async with factory() as session:
            yield session

    app = FastAPI()
    app.include_router(tickets_router)
    app.include_router(slack_router)
    app.include_router(onboard_router)
    app.include_router(integration_router)
    app.dependency_overrides[get_session] = _test_session

    async def _seed_conn(conn: JiraConnection):
        async with factory() as session:
            session.add(conn)
            await session.commit()

    with TestClient(app) as c:
        c.test_seed_conn = _seed_conn  # type: ignore[attr-defined]
        yield c

    app.dependency_overrides.clear()


@pytest.fixture()
def session_store():
    key = normalize_repo_url(REPO)
    onboard_mod._session_store[key] = {
        "graph": {"nodes": [], "edges": []},
        "repo_path": "/tmp",
        "file_list": [],
    }
    yield key
    onboard_mod._session_store.pop(key, None)


# ── 03.1 chat error contract ──

def test_chat_provider_error_contract_no_leak(client, session_store, monkeypatch):
    marker = "PROVIDER-SECRET-xyz-401"
    raw_payload = '{"error": {"message": "%s", "code": 401}}' % marker

    def _boom(repo_url: str):
        raise RuntimeError(raw_payload)

    import app.ingestion.vector_store as vs

    monkeypatch.setattr(vs, "get_vector_store", _boom)
    resp = client.post("/ask", json={"session_id": REPO, "question": "hi?"})
    assert resp.status_code == 200
    assert resp.json() == {"error": "chat_unavailable", "retryable": True}
    assert marker not in resp.text
    assert "401" not in resp.text


# ── 04 ticket CRUD ──

def test_ticket_create_list_delete(client):
    created = client.post(
        "/tickets",
        json={"repo": REPO, "title": "SQLi in search", "description": "d", "severity": "high", "source_finding_id": "f1"},
    ).json()
    assert created["status"] == "open"
    assert created["severity"] == "high"
    tid = created["id"]

    listed = client.get("/tickets", params={"repo": REPO}).json()
    assert [t["id"] for t in listed] == [tid]

    assert client.delete(f"/tickets/{tid}").json() == {"ok": True}
    assert client.get("/tickets", params={"repo": REPO}).json() == []


def test_ticket_low_info_rejected(client):
    for sev in ("low", "info", "LOW"):
        resp = client.post(
            "/tickets",
            json={"repo": REPO, "title": "t", "severity": sev, "source_finding_id": f"x-{sev}"},
        ).json()
        assert resp.get("error") == "ticket_not_eligible", sev


def test_ticket_idempotent_on_finding(client):
    a = client.post(
        "/tickets",
        json={"repo": REPO, "title": "t", "severity": "critical", "source_finding_id": "dup"},
    ).json()
    b = client.post(
        "/tickets",
        json={"repo": REPO, "title": "t again", "severity": "critical", "source_finding_id": "dup"},
    ).json()
    assert a["id"] == b["id"]


def test_ticket_invalid_severity_defaults_medium(client):
    created = client.post(
        "/tickets",
        json={"repo": REPO, "title": "t", "severity": "bogus", "source_finding_id": "s1"},
    ).json()
    assert created["severity"] == "medium"


# ── 04 Jira push (mocked OAuth) ──

def test_push_jira_not_connected(client):
    tid = client.post(
        "/tickets",
        json={"repo": REPO, "title": "t", "severity": "high", "source_finding_id": "p1"},
    ).json()["id"]
    resp = client.post(f"/tickets/{tid}/push-jira").json()
    assert resp.get("error") == "jira_not_connected"


def test_push_jira_mocked(client, monkeypatch):
    tid = client.post(
        "/tickets",
        json={"repo": REPO, "title": "Fix auth", "description": "desc", "severity": "critical", "source_finding_id": "p2"},
    ).json()["id"]

    async def _fake_token(session):
        return "tok", "cloud1"

    async def _fake_projects(cloud_id, access):
        assert (cloud_id, access) == ("cloud1", "tok")
        return [{"key": "PROJ"}]

    async def _fake_create(cloud_id, access, project_key, **kwargs):
        assert project_key == "PROJ"
        assert kwargs["summary"] == "Fix auth"
        assert "severity-critical" in kwargs["labels"]
        return {"key": "PROJ-1"}

    monkeypatch.setattr(tickets_mod, "_get_valid_token", _fake_token)
    monkeypatch.setattr("app.integrations.jira_oauth.get_projects", _fake_projects)
    monkeypatch.setattr("app.integrations.jira_oauth.create_jira_issue", _fake_create)

    # Seed a connection row so the browse URL resolves (token path is mocked).
    asyncio.run(
        client.test_seed_conn(
            JiraConnection(
                user_key="default",
                site_url="https://acme.atlassian.net|cloud1",
                site_name="acme",
                encrypted_access_token="x",
                encrypted_refresh_token="y",
            )
        )
    )

    resp = client.post(f"/tickets/{tid}/push-jira").json()
    assert resp["ok"] is True
    assert resp["issue_key"] == "PROJ-1"
    assert resp["issue_url"] == "https://acme.atlassian.net/browse/PROJ-1"

    listed = client.get("/tickets", params={"repo": REPO}).json()
    row = next(t for t in listed if t["id"] == tid)
    assert row["status"] == "pushed"
    assert row["jira_issue_key"] == "PROJ-1"


# ── 06 Slack share (mocked API) ──

def test_slack_share_mocked(client, monkeypatch):
    calls: list = []

    async def _fake_token(session):
        return "tok"

    async def _fake_post(access_token, channel, text, blocks=None):
        calls.append({"token": access_token, "channel": channel, "text": text, "blocks": blocks or []})
        return {"ok": True}

    monkeypatch.setattr(slack_mod, "_get_token", _fake_token)
    monkeypatch.setattr("app.integrations.slack_oauth.post_message", _fake_post)

    resp = client.post(
        "/integrations/slack/share",
        json={
            "repo": REPO,
            "channel": "C123",
            "health_score": 82,
            "grade": "B",
            "findings": [{"severity": "critical", "title": "SQLi"}],
            "report_url": "http://x/y",
        },
    ).json()
    assert resp.get("ok") is True
    assert len(calls) == 1
    assert calls[0]["channel"] == "C123"
    blob = calls[0]["text"] + " " + str(calls[0]["blocks"])
    assert "82" in blob and "B" in blob
    assert "Open in CodeAtlas" in blob


def test_slack_share_not_connected_calls_nothing(client, monkeypatch):
    async def _none(session):
        return None

    post = AsyncMock()
    monkeypatch.setattr(slack_mod, "_get_token", _none)
    monkeypatch.setattr("app.integrations.slack_oauth.post_message", post)
    resp = client.post("/integrations/slack/share", json={"repo": REPO, "channel": "C1"}).json()
    assert resp.get("error") == "slack_not_connected"
    assert post.await_count == 0


def test_slack_share_missing_channel(client, monkeypatch):
    async def _fake_token(session):
        return "tok"

    monkeypatch.setattr(slack_mod, "_get_token", _fake_token)
    resp = client.post("/integrations/slack/share", json={"repo": REPO, "channel": ""}).json()
    assert resp.get("error") == "missing_channel"
