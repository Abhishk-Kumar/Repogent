import asyncio
import json
import logging
import uuid
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db import get_session, async_session_factory
from app.models.db_models import Job
from app.utils.normalize import normalize_repo_url, get_repo_hash

logger = logging.getLogger(__name__)

router = APIRouter()

BACKGROUND_TASKS: dict[str, asyncio.Task] = {}
_REPO_LOCKS: dict[str, asyncio.Lock] = {}
_REPO_LOCK = asyncio.Lock()


async def reset_stale_jobs():
    async with async_session_factory() as session:
        result = await session.execute(
            select(Job).where(Job.status.in_(["pending", "running"]))
        )
        stale = result.scalars().all()
        for job in stale:
            job.status = "failed"
            job.error_message = "Server restarted — job reset"
            session.add(job)
        await session.commit()
        if stale:
            logger.info("Reset %d stale job(s)", len(stale))


class JobStatusResponse(BaseModel):
    job_id: str
    status: str
    progress_current: int
    progress_total: int
    progress_message: str
    error_message: str | None = None
    result: dict | None = None


async def _get_repo_lock(repo_identifier: str) -> asyncio.Lock:
    async with _REPO_LOCK:
        if repo_identifier not in _REPO_LOCKS:
            _REPO_LOCKS[repo_identifier] = asyncio.Lock()
        return _REPO_LOCKS[repo_identifier]


@router.post("/jobs/submit")
async def submit_job(request: dict):
    repo_url = request.get("repo_url", "")
    job_type = request.get("job_type", "onboard")
    if not repo_url:
        return {"error": "repo_url is required"}

    repo_identifier = get_repo_hash(repo_url)  # Hash for database storage
    lock = await _get_repo_lock(repo_identifier)

    async with lock:
        async with async_session_factory() as session:
            existing = await session.execute(
                select(Job).where(
                    Job.repo_identifier == repo_identifier,
                    Job.job_type == job_type,
                    Job.status.in_(["pending", "running"]),
                ).order_by(Job.created_at.desc()).limit(1)
            )
            existing_job = existing.scalar_one_or_none()
            if existing_job:
                logger.info("Reusing existing %s job %s for %s", job_type, existing_job.id, repo_identifier)
                return {"job_id": existing_job.id, "status": existing_job.status}

            job_id = str(uuid.uuid4())[:8]
            job = Job(
                id=job_id,
                repo_identifier=repo_identifier,
                job_type=job_type,
                status="running",
                progress_current=1,
                progress_total=7,
                progress_message="Starting...",
            )
            session.add(job)
            await session.commit()

    task = asyncio.create_task(_run_job(job_id, repo_url, job_type))
    BACKGROUND_TASKS[job_id] = task

    logger.info("Created new %s job %s for %s", job_type, job_id, repo_identifier)
    return {"job_id": job_id, "status": "running"}


@router.get("/jobs/{job_id}/status", response_model=JobStatusResponse)
async def get_job_status(job_id: str, session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        return JobStatusResponse(
            job_id=job_id,
            status="failed",
            progress_current=0,
            progress_total=0,
            progress_message="",
            error_message="Job not found",
        )

    result_json = json.loads(job.result_json) if job.result_json else None

    return JobStatusResponse(
        job_id=job.id,
        status=job.status,
        progress_current=job.progress_current,
        progress_total=job.progress_total,
        progress_message=job.progress_message,
        error_message=job.error_message,
        result=result_json,
    )


async def update_job(job_id: str, **kwargs):
    async with async_session_factory() as session:
        result = await session.execute(select(Job).where(Job.id == job_id))
        job = result.scalar_one_or_none()
        if job:
            for k, v in kwargs.items():
                setattr(job, k, v)
            session.add(job)
            await session.commit()


async def _run_job(job_id: str, repo_url: str, job_type: str):
    from app.config import settings
    try:
        await update_job(job_id, status="running", progress_message="Starting...")

        async def _execute():
            if job_type == "onboard":
                await _run_onboard(job_id, repo_url)
            elif job_type == "scan":
                await _run_scan(job_id, repo_url)
            else:
                await update_job(job_id, status="failed", error_message=f"Unknown job type: {job_type}")

        await asyncio.wait_for(
            _execute(),
            timeout=settings.job_hard_timeout_seconds,
        )

    except asyncio.TimeoutError:
        logger.warning("Job %s timed out after %ds", job_id, settings.job_hard_timeout_seconds)
        await update_job(job_id, status="failed",
                         error_message=f"Processing timed out after {settings.job_hard_timeout_seconds} seconds")
    except asyncio.CancelledError:
        await update_job(job_id, status="failed", error_message="Job was cancelled")
    except Exception as e:
        logger.exception("Job %s failed", job_id)
        await update_job(job_id, status="failed", error_message=str(e)[:512])
    finally:
        BACKGROUND_TASKS.pop(job_id, None)


async def _run_onboard(job_id: str, repo_url: str):
    from app.cache import get_cached, set_cache
    from app.utils.normalize import normalize_repo_url, get_cache_key, get_latest_commit_sha
    from app.ingestion.repo_loader import load_repo, cleanup_repo
    from app.ingestion.chunker import chunk_files
    from app.ingestion.vector_store import build_vector_store
    from app.tools.code_tools import set_repo_context
    from app.graph.graph_builder import build_dependency_graph
    from app.chains.node_label_chain import generate_node_labels
    from app.routes.onboard import _session_store

    normalized_url = normalize_repo_url(repo_url)
    # Get latest commit SHA for cache key
    commit_sha = get_latest_commit_sha(repo_url)
    if commit_sha:
        logger.info("Using commit-aware cache key for %s (commit: %s)", normalized_url, commit_sha[:8])
    cache_key = get_cache_key(repo_url, commit_sha)
    cached = await get_cached(cache_key)
    if cached:
        logger.info("Cache hit for %s — serving cached result", normalized_url)
        await update_job(job_id, status="done", progress_current=7, progress_total=7,
                         progress_message="Ready (cached)", result_json=json.dumps(cached))
        return

    metadata = None
    session_stored = False
    try:
        loop = asyncio.get_event_loop()

        await update_job(job_id, progress_message="Cloning repository...",
                         progress_current=1, progress_total=7)
        metadata, files = await loop.run_in_executor(None, load_repo, repo_url)

        await update_job(job_id, progress_message="Chunking files...",
                         progress_current=2, progress_total=7)
        docs = await loop.run_in_executor(None, chunk_files, files, metadata.local_path)

        await update_job(job_id, progress_message="Building vector store...",
                         progress_current=3, progress_total=7)
        try:
            vectorstore = await loop.run_in_executor(None, build_vector_store, docs, repo_url)
            set_repo_context(metadata.local_path, vectorstore)
        except Exception as e:
            logger.warning("Vector store build failed: %s", e)

        await update_job(job_id, progress_message="Building dependency graph...",
                         progress_current=4, progress_total=7)
        graph = await loop.run_in_executor(None, build_dependency_graph, metadata.local_path, files)

        await update_job(job_id, progress_message="Generating AI labels...",
                         progress_current=5, progress_total=7)
        try:
            graph["nodes"] = await generate_node_labels(graph["nodes"])
        except Exception as e:
            logger.warning("Node labeling failed: %s", e)

        await update_job(job_id, progress_message="Finalizing report...",
                         progress_current=6, progress_total=7)

        _session_store[normalized_url] = {
            "repo_path": metadata.local_path,
            "graph": graph,
            "file_list": files,
            "commit_sha": commit_sha,
        }
        session_stored = True

        result = {
            "dependency_graph": graph,
            "file_count": metadata.file_count,
            "languages": metadata.languages_detected,
            "sources": [n["id"] for n in graph.get("nodes", [])],
            "status": "complete",
        }

        await set_cache(cache_key, result)
        await update_job(job_id, status="done", progress_current=7, progress_total=7,
                         progress_message="Ready", result_json=json.dumps(result))
    except Exception as e:
        logger.exception("Onboard job %s failed", job_id)
        raise
    finally:
        # Clean up cloned directory only if onboarding failed before session was stored
        # or if the job failed entirely. Successful onboarding keeps the directory
        # for subsequent operations (chat, explain, trace).
        if metadata and metadata.local_path and not session_stored:
            try:
                cleanup_repo(metadata.local_path)
                logger.info("Cleaned up cloned repo directory after failed onboard: %s", metadata.local_path)
            except Exception as cleanup_e:
                logger.warning("Failed to cleanup repo directory %s: %s", metadata.local_path, cleanup_e)


async def _run_scan(job_id: str, repo_url: str):
    from app.cache import get_cached, set_cache
    from app.utils.normalize import normalize_repo_url, get_cache_key, get_latest_commit_sha
    from app.routes.integration import _build_session_from_repo, _session_store

    normalized_url = normalize_repo_url(repo_url)
    # Get latest commit SHA for cache key
    commit_sha = get_latest_commit_sha(repo_url)
    if commit_sha:
        logger.info("Using commit-aware cache key for scan %s (commit: %s)", normalized_url, commit_sha[:8])
    cache_key = get_cache_key(repo_url, commit_sha + ":scan")
    cached = await get_cached(cache_key)
    if cached:
        logger.info("Cache hit for scan %s — serving cached result", normalized_url)
        await update_job(job_id, status="done", progress_current=1, progress_total=1,
                         progress_message="Scan complete (cached)", result_json=json.dumps(cached))
        return

    session = _session_store.get(normalized_url)
    if not session:
        session = await _build_session_from_repo(repo_url)

    if not session:
        await update_job(job_id, status="failed", error_message="Could not load repo")
        return

    from app.routes.integration import _generate_scan_report
    loop = asyncio.get_event_loop()
    report = await loop.run_in_executor(None, _generate_scan_report, session)

    # 06.1 notify-on-complete: fire exactly once per completed scan, iff opted in.
    try:
        from app.routes.slack import maybe_notify_scan_complete
        async with async_session_factory() as notify_session:
            await maybe_notify_scan_complete(
                notify_session,
                repo_url,
                float(getattr(report, "score", 0) or 0),
                str(getattr(report, "grade", "") or ""),
                len(getattr(report, "issues", []) or []),
            )
    except Exception:
        logger.warning("Slack notify-on-complete failed (non-fatal)", exc_info=True)

    result = report.model_dump()
    await set_cache(cache_key, result)
    await update_job(job_id, status="done", progress_current=1, progress_total=1,
                     progress_message="Scan complete", result_json=json.dumps(result))
