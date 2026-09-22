import asyncio
import json
import logging
import uuid

from fastapi import APIRouter
from pydantic import BaseModel

from app.db import async_session_factory
from app.models.db_models import Job, _normalize_repo_identifier, AutoFixPR, GitHubConnection
from app.routes.jobs import BACKGROUND_TASKS, update_job

logger = logging.getLogger(__name__)

router = APIRouter()


class AutoFixRequest(BaseModel):
    repo_url: str
    scan_issues: list[dict]


class AutoFixStatusResponse(BaseModel):
    job_id: str
    status: str
    auto_fixable_count: int = 0
    progress_message: str = ""
    result: dict | None = None


@router.post("/autofix/estimate")
async def estimate_autofix(request: AutoFixRequest):
    from app.agents.triage_agent import triage_issues
    results = triage_issues(request.scan_issues)
    fixable = sum(1 for r in results if r.auto_fixable)
    return {"total_issues": len(request.scan_issues), "auto_fixable": fixable}


@router.post("/autofix/run")
async def run_autofix(request: AutoFixRequest):
    job_id = str(uuid.uuid4())[:8]
    repo_identifier = _normalize_repo_identifier(request.repo_url)

    async with async_session_factory() as session:
        from sqlalchemy import select
        existing = await session.execute(
            select(GitHubConnection).where(GitHubConnection.repo_identifier == repo_identifier)
        )
        conn = existing.scalar_one_or_none()
        if not conn:
            return {"error": "No GitHub connection found for this repo. Connect GitHub first."}

    async with async_session_factory() as session:
        job = Job(id=job_id, repo_identifier=repo_identifier, job_type="autofix", status="pending")
        session.add(job)
        await session.commit()

    from app.agents.triage_agent import triage_issues
    triage_results = triage_issues(request.scan_issues)
    fixable_count = sum(1 for r in triage_results if r.auto_fixable)

    if fixable_count == 0:
        await update_job(job_id, status="done", progress_message="No auto-fixable issues",
                         result_json=json.dumps({"fixed": 0}))
        return {"job_id": job_id, "status": "done", "auto_fixable_count": 0}

    from app.routes.onboard import _session_store
    from app.utils.normalize import normalize_repo_url
    session_data = _session_store.get(normalize_repo_url(request.repo_url))
    repo_path = session_data.get("repo_path", "") if session_data else ""

    task = asyncio.create_task(
        _run_autofix_pipeline(job_id, repo_identifier, repo_path, request.scan_issues)
    )
    BACKGROUND_TASKS[job_id] = task

    return {"job_id": job_id, "status": "pending", "auto_fixable_count": fixable_count}


async def _run_autofix_pipeline(job_id: str, repo_identifier: str, repo_path: str, scan_issues: list[dict]):
    try:
        from app.agents.autofix_pipeline import run_autofix_pipeline
        await run_autofix_pipeline(job_id, repo_identifier, repo_path, scan_issues)
    except Exception as e:
        logger.exception("Auto-fix pipeline failed")
        await update_job(job_id, status="failed", error_message=str(e)[:512])
    finally:
        BACKGROUND_TASKS.pop(job_id, None)


@router.get("/autofix/prs/{repo_url:path}")
async def get_autofix_prs(repo_url: str):
    repo_identifier = _normalize_repo_identifier(repo_url)
    async with async_session_factory() as session:
        from sqlalchemy import select
        result = await session.execute(
            select(AutoFixPR).where(AutoFixPR.repo_identifier == repo_identifier).order_by(AutoFixPR.created_at.desc()).limit(10)
        )
        prs = result.scalars().all()
        return [
            {"pr_url": pr.pr_url, "pr_number": pr.pr_number, "created_at": pr.created_at.isoformat()}
            for pr in prs
        ]
