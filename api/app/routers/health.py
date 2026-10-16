from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel

from app import __version__
from app.db import engine as db

router = APIRouter(tags=["health"])


class HealthResponse(BaseModel):
    status: Literal["ok"]
    version: str
    db: bool


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    """Liveness plus a best-effort database ping. Always 200 so the app boots without Postgres."""
    return HealthResponse(status="ok", version=__version__, db=await db.check_db())
