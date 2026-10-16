from fastapi import APIRouter

from app.deps import DB, CurrentUser
from app.schemas.progress import ProgressResponse
from app.services.progress_service import build_progress

router = APIRouter(tags=["progress"])


@router.get("/progress", response_model=ProgressResponse)
async def progress(db: DB, user: CurrentUser) -> ProgressResponse:
    """Calendar, streaks, weak-spot trend, vocabulary growth and session history."""
    return await build_progress(db, user)
