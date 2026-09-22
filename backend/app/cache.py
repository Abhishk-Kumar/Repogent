import json
import logging
from datetime import datetime, timezone

from sqlalchemy import select
from app.db import async_session_factory
from app.models.db_models import ResponseCache
from app.utils.normalize import get_cache_key

logger = logging.getLogger(__name__)


async def get_cached(key: str) -> dict | None:
    async with async_session_factory() as session:
        result = await session.execute(select(ResponseCache).where(ResponseCache.cache_key == key))
        entry = result.scalar_one_or_none()
        if entry:
            logger.info("Cache hit: %s", key)
            return json.loads(entry.value_json)
    logger.info("Cache miss: %s", key)
    return None


async def set_cache(key: str, value: dict):
    async with async_session_factory() as session:
        existing = await session.execute(select(ResponseCache).where(ResponseCache.cache_key == key))
        entry = existing.scalar_one_or_none()
        if entry:
            entry.value_json = json.dumps(value)
            entry.created_at = datetime.now(timezone.utc)
        else:
            entry = ResponseCache(cache_key=key, value_json=json.dumps(value))
        session.add(entry)
        await session.commit()
    logger.info("Cache set: %s", key)
