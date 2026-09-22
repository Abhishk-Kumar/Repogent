import logging

from fastapi import APIRouter
from app.db import async_session_factory
from app.models.db_models import ScanHistory, _normalize_repo_identifier

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/scan_history/{repo_url:path}")
async def get_scan_history(repo_url: str):
    repo_identifier = _normalize_repo_identifier(repo_url)
    async with async_session_factory() as session:
        from sqlalchemy import select
        result = await session.execute(
            select(ScanHistory)
            .where(ScanHistory.repo_identifier == repo_identifier)
            .order_by(ScanHistory.scanned_at.asc())
            .limit(50)
        )
        entries = result.scalars().all()
        return [
            {
                "health_score": e.health_score,
                "complexity_score": e.complexity_score,
                "test_coverage": e.test_coverage,
                "doc_coverage": e.doc_coverage,
                "scanned_at": e.scanned_at.isoformat(),
            }
            for e in entries
        ]


@router.post("/scan_history")
async def save_scan_history(request: dict):
    import json
    repo_url = request.get("repo_url", "")
    report = request.get("report", {})
    if not repo_url:
        return {"error": "repo_url required"}

    repo_identifier = _normalize_repo_identifier(repo_url)
    async with async_session_factory() as session:
        entry = ScanHistory(
            repo_identifier=repo_identifier,
            health_score=report.get("score", 0),
            complexity_score=next((m.get("value", 0) for m in report.get("metrics", []) if m.get("label") == "Complexity"), 0),
            test_coverage=next((m.get("value", 0) for m in report.get("metrics", []) if m.get("label") == "Test coverage"), 0),
            doc_coverage=next((m.get("value", 0) for m in report.get("metrics", []) if m.get("label") == "Doc coverage"), 0),
            issues_json=json.dumps(report.get("issues", [])),
        )
        session.add(entry)
        await session.commit()
    return {"status": "saved"}
