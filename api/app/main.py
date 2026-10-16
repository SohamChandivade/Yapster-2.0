from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.config import get_settings
from app.db.engine import dispose_engine
from app.http import close_http
from app.origins import PRIVATE_ORIGIN_REGEX
from app.routers import auth, dashboard, health, progress, scenarios, sessions, users, vocab


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    yield
    await close_http()
    await dispose_engine()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="Yapster API", version=__version__, lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_origin_regex=PRIVATE_ORIGIN_REGEX if settings.cors_allow_private_networks else None,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(health.router)
    app.include_router(auth.router)
    app.include_router(users.router)
    app.include_router(sessions.router)
    app.include_router(scenarios.router)
    app.include_router(vocab.router)
    app.include_router(dashboard.router)
    app.include_router(progress.router)
    return app


app = create_app()
