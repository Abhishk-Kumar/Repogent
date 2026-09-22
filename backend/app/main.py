import logging
import sys

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes.onboard import router as onboard_router
from app.routes.integration import router as integration_router
from app.routes.jobs import router as jobs_router
from app.routes.github_webhook import router as github_router
from app.routes.autofix import router as autofix_router
from app.routes.history import router as history_router
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
    logger.info("Server ready")
