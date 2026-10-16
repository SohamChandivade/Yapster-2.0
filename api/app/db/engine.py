import asyncio
import logging
from collections.abc import AsyncIterator
from typing import Any
from uuid import uuid4

from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.config import get_settings

log = logging.getLogger("yapster.db")

_engine: AsyncEngine | None = None
_session_factory: async_sessionmaker[AsyncSession] | None = None


def connect_args(url: str) -> dict[str, Any]:
    """Extra asyncpg arguments for the given URL.

    Neon's pooled endpoint ("-pooler" host) is PgBouncer in transaction mode, which cannot
    reuse asyncpg's named prepared statements across server connections. Disable the cache
    and give every statement a unique name so it works anyway. Prefer the direct endpoint:
    the API keeps its own small pool and needs none of this.
    """
    if "-pooler." not in url:
        return {}
    log.warning("DATABASE_URL uses a pooled endpoint; Neon's direct connection string is simpler")
    return {
        "statement_cache_size": 0,
        "prepared_statement_name_func": lambda: f"__asyncpg_{uuid4()}__",
    }


def get_engine() -> AsyncEngine:
    global _engine
    if _engine is None:
        url = get_settings().database_url
        _engine = create_async_engine(url, pool_pre_ping=True, connect_args=connect_args(url))
    return _engine


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    global _session_factory
    if _session_factory is None:
        _session_factory = async_sessionmaker(get_engine(), expire_on_commit=False)
    return _session_factory


async def get_session() -> AsyncIterator[AsyncSession]:
    """FastAPI dependency: one session per request."""
    async with get_session_factory()() as session:
        yield session


async def check_db(timeout_s: float = 5.0) -> bool:
    """True when the database answers SELECT 1 within the timeout.

    Five seconds, not two: a hosted database that scaled to zero (Neon) needs a moment to
    wake, and the health check is the first thing to hit it after idle.
    """
    try:
        async with asyncio.timeout(timeout_s), get_engine().connect() as conn:
            await conn.execute(text("SELECT 1"))
    except Exception:
        return False
    return True


async def dispose_engine() -> None:
    global _engine, _session_factory
    if _engine is not None:
        await _engine.dispose()
    _engine = None
    _session_factory = None
