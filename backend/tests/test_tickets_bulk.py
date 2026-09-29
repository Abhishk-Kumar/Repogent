"""Bulk ticket creation tests (POST /tickets/bulk replaces the N+1 loop)."""
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlmodel import SQLModel

import app.models.db_models  # noqa: F401
from app.db import get_session
from app.routes.tickets import router as tickets_router

REPO = "https://github.com/acme/bulk"


def _client(tmp_path):
    import asyncio

    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path}/bulk.db")
    factory = async_sessionmaker(engine, expire_on_commit=False)

    async def _init():
        async with engine.begin() as conn:
            await conn.run_sync(SQLModel.metadata.create_all)

    asyncio.run(_init())

    async def _session():
        async with factory() as s:
            yield s

    app = FastAPI()
    app.include_router(tickets_router)
    app.dependency_overrides[get_session] = _session
    return TestClient(app)


def test_bulk_creates_mixed_batch(tmp_path):
    c = _client(tmp_path)
    resp = c.post(
        "/tickets/bulk",
        json={
            "repo": REPO,
            "issues": [
                {"title": "A", "severity": "critical", "source_finding_id": "a"},
                {"title": "B", "severity": "medium", "source_finding_id": "b"},
                {"title": "C-low", "severity": "low", "source_finding_id": "c"},
                {"title": "Dup", "severity": "high", "source_finding_id": "a"},
            ],
        },
    ).json()
    assert resp["count"] == 2
    assert sorted(t["source_finding_id"] for t in resp["created"]) == ["a", "b"]
    reasons = {s["source_finding_id"]: s["reason"] for s in resp["skipped"]}
    assert reasons == {"c": "ticket_not_eligible", "a": "duplicate_in_batch"}
    listed = c.get("/tickets", params={"repo": REPO}).json()
    assert len(listed) == 2


def test_bulk_idempotent_across_calls(tmp_path):
    c = _client(tmp_path)
    body = {"repo": REPO, "issues": [{"title": "A", "severity": "high", "source_finding_id": "a"}]}
    first = c.post("/tickets/bulk", json=body).json()
    second = c.post("/tickets/bulk", json=body).json()
    assert first["count"] == 1
    assert second["count"] == 1
    assert first["created"][0]["id"] == second["created"][0]["id"]
    assert len(c.get("/tickets", params={"repo": REPO}).json()) == 1


def test_bulk_empty_and_invalid_severity(tmp_path):
    c = _client(tmp_path)
    assert c.post("/tickets/bulk", json={"repo": REPO, "issues": []}).json()["count"] == 0
    resp = c.post(
        "/tickets/bulk",
        json={"repo": REPO, "issues": [{"title": "X", "severity": "bogus", "source_finding_id": "x"}]},
    ).json()
    assert resp["count"] == 1
    assert resp["created"][0]["severity"] == "medium"
