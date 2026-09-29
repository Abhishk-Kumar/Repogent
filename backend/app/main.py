import logging
import sys

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.security import make_security_middleware

from app.routes.onboard import router as onboard_router
from app.routes.integration import router as integration_router
from app.routes.jobs import router as jobs_router
from app.routes.github_webhook import router as github_router
from app.routes.autofix import router as autofix_router
from app.routes.history import router as history_router
from app.routes.tickets import router as tickets_router
from app.routes.slack import router as slack_router
from app.routes.api_keys import router as api_keys_router
from app.routes.metrics import router as metrics_router
from app.config import settings
import os
from fastapi.staticfiles import StaticFiles

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Codebase Onboarding Agent")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(onboard_router)
app.include_router(integration_router)
app.include_router(jobs_router)
app.include_router(github_router)
app.include_router(autofix_router)
app.include_router(history_router)
app.include_router(tickets_router)
app.include_router(slack_router)
app.include_router(api_keys_router)
app.include_router(metrics_router)

app.add_middleware(
    BaseHTTPMiddleware,
    dispatch=make_security_middleware(
        secret=settings.deploy_secret,
        site_url=settings.site_url,
        ask_limit_per_min=settings.ask_rate_limit_per_min,
    ),
)
if not settings.deploy_secret:
    logger.warning("DEPLOY_SECRET unset — cross-origin guard is fail-open (fine for local dev).")


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/health/llm")
async def health_llm():
    from app.llm_router import router as llm_router
    return {
        "status": "ok",
        "provider": llm_router.get_provider_name(),
    }


STATIC_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "static")
app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")


@app.exception_handler(404)
async def branded_not_found(request: Request, exc):
    """Browsers get the branded static 404 page (real 404 status); API
    clients keep JSON. Unknown deep links no longer return bare errors."""
    accept = request.headers.get("accept", "")
    page = os.path.join(STATIC_DIR, "404.html")
    if "text/html" in accept and os.path.isfile(page):
        return FileResponse(page, status_code=404, media_type="text/html")
    return JSONResponse(status_code=404, content={"error": "not_found"})


@app.on_event("startup")
async def startup():
    from app.db import init_db
    await init_db()
    from app.routes.jobs import reset_stale_jobs
    await reset_stale_jobs()
    logger.info("Starting Codebase Onboarding Agent v3...")
    logger.info("Embedding model: %s", settings.embedding_model)
    logger.info("Vector store path: %s", settings.vector_store_path)
    logger.info("DB path: %s", settings.db_path)
    logger.info("Chat model: %s", settings.chat_model_id)
    # Startup self-check: warn if configured chat model is a known-retired ID.
    # Groq retired llama-3.3-70b-versatile / llama-3.1-8b-instant on 2026-08-16;
    # current production flagship is openai/gpt-oss-120b. Full live-list check
    # requires a GROQ_API_KEY; without it we validate against the known list.
    _retired = {"llama-3.3-70b-versatile", "llama-3.1-8b-instant", "qwen/qwen3-32b"}
    _known_good = {
        "openai/gpt-oss-120b", "openai/gpt-oss-20b",
        "meta-llama/llama-4-scout-17b-16e-instruct",
        "meta-llama/llama-4-maverick-17b-128e-instruct",
        "moonshotai/kimi-k2-instruct-0905", "qwen/qwen3-32b",
        "llama-3.1-8b-instant",
    }
    if settings.chat_model_id in _retired:
        logger.warning(
            "Configured CHAT_MODEL_ID=%s is retired by Groq (2026-08-16). "
            "Set CHAT_MODEL_ID to a current ID, e.g. openai/gpt-oss-120b.",
            settings.chat_model_id,
        )
    elif settings.chat_model_id not in _known_good:
        logger.warning(
            "Configured CHAT_MODEL_ID=%s not in the known-good list "
            "(cached 2026-08-20). Verify against GET /openai/v1/models.",
            settings.chat_model_id,
        )
    logger.info("Server ready")
