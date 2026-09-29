import logging
from pathlib import Path
from sqlmodel import SQLModel
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

logger = logging.getLogger(__name__)

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "codeatlas.db"
DB_URL = f"sqlite+aiosqlite:///{DB_PATH}"

engine = create_async_engine(DB_URL, echo=False, connect_args={"check_same_thread": False})

async_session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def init_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    from app.models.db_models import Job, ScanHistory, GitHubConnection, AutoFixPR, ResponseCache, Ticket, JiraConnection, SlackConnection, ApiKey
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    logger.info("Database initialized at %s", DB_PATH)


async def get_session() -> AsyncSession:
    async with async_session_factory() as session:
        yield session
