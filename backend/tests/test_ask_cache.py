"""Ask-answer caching tests: identical questions hit ResponseCache logic
per repo+commit; new questions and new commits miss. LLM fully mocked."""
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.routes import onboard as onboard_mod
from app.routes.onboard import router as onboard_router
from app.utils.normalize import normalize_repo_url

REPO = "https://github.com/acme/demo"


@pytest.fixture()
def client(monkeypatch):
    store: dict = {}
    calls = {"llm": 0}

    async def _get_cached(key: str):
        return store.get(key)

    async def _set_cache(key: str, value: dict):
        store[key] = value

    class _FakeStore:
        def similarity_search(self, q, k=5):
            return []

    def _fake_vs(repo_url: str):
        return _FakeStore()

    def _fake_llm():
        from langchain_core.runnables import RunnableLambda

        return RunnableLambda(lambda x: "canned")

    async def _fake_call(chain, inputs, purpose=None):
        calls["llm"] += 1
        return "canned"

    monkeypatch.setattr(onboard_mod, "get_cached", _get_cached)
    monkeypatch.setattr(onboard_mod, "set_cache", _set_cache)
    monkeypatch.setattr("app.ingestion.vector_store.get_vector_store", _fake_vs)
    monkeypatch.setattr("app.llm_router.get_llm", _fake_llm)
    monkeypatch.setattr("app.llm_router.call_llm_with_retry", _fake_call)

    key = normalize_repo_url(REPO)
    onboard_mod._session_store[key] = {
        "graph": {"nodes": [], "edges": []},
        "repo_path": "/tmp",
        "file_list": [],
        "commit_sha": "abc123",
    }

    app = FastAPI()
    app.include_router(onboard_router)
    with TestClient(app) as c:
        c.test_calls = calls  # type: ignore[attr-defined]
        yield c

    onboard_mod._session_store.pop(key, None)


def test_repeat_question_served_from_cache(client):
    r1 = client.post("/ask", json={"session_id": REPO, "question": "What does this do?"}).json()
    assert r1 == {"answer": "canned"}
    assert client.test_calls["llm"] == 1
    r2 = client.post("/ask", json={"session_id": REPO, "question": "What does this do?"}).json()
    assert r2 == {"answer": "canned", "cached": True}
    assert client.test_calls["llm"] == 1


def test_case_insensitive_cache_key(client):
    client.post("/ask", json={"session_id": REPO, "question": "Hello There"}).json()
    assert client.test_calls["llm"] == 1
    r = client.post("/ask", json={"session_id": REPO, "question": "  hello there "}).json()
    assert r.get("cached") is True
    assert client.test_calls["llm"] == 1


def test_new_question_misses(client):
    client.post("/ask", json={"session_id": REPO, "question": "one"}).json()
    client.post("/ask", json={"session_id": REPO, "question": "two"}).json()
    assert client.test_calls["llm"] == 2
