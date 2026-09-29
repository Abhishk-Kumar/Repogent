"""10.2 — real aggregate metrics for the homepage stats strip + README.

Real numbers only: computed live from jobs/scan_history/tickets/api_keys.
No chat-question counter exists (no persistence for chat turns) — so none is
reported rather than a placeholder.
"""
import logging
import statistics

from fastapi import APIRouter
from sqlalchemy import func, select

from app.db import async_session_factory
from app.models.db_models import ApiKey, Job, ScanHistory, Ticket

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/metrics")
async def get_metrics():
    async with async_session_factory() as session:
        repos = (
            await session.execute(
                select(func.count(func.distinct(Job.repo_identifier))).where(
                    Job.status == "done", Job.job_type == "onboard"
                )
            )
        ).scalar() or 0

        analyses = (
            await session.execute(
                select(func.count(Job.id)).where(Job.status == "done", Job.job_type == "onboard")
            )
        ).scalar() or 0

        scans = (await session.execute(select(func.count(ScanHistory.id)))).scalar() or 0
        tickets = (await session.execute(select(func.count(Ticket.id)))).scalar() or 0
        mcp_keys = (
            await session.execute(select(func.count(ApiKey.id)).where(ApiKey.is_active == True))  # noqa: E712
        ).scalar() or 0

        durations: list[float] = []
        rows = (
            await session.execute(
                select(Job.created_at, Job.updated_at).where(
                    Job.status == "done", Job.job_type == "onboard"
                )
            )
        ).all()
        for created, updated in rows:
            try:
                durations.append((updated - created).total_seconds())
            except Exception:
                continue

    return {
        "repos_analyzed": repos,
        "analyses_completed": analyses,
        "median_analysis_seconds": round(statistics.median(durations)) if durations else None,
        "scans_completed": scans,
        "tickets_created": tickets,
        "mcp_keys_active": mcp_keys,
    }
