from fastapi import APIRouter

from app.deps import DB, CurrentUser
from app.schemas.dashboard import DashboardResponse
from app.services.dashboard_service import build_dashboard

router = APIRouter(tags=["dashboard"])


@router.get("/dashboard", response_model=DashboardResponse)
async def dashboard(db: DB, user: CurrentUser) -> DashboardResponse:
    """Everything the Home screen shows, computed from real sessions and notes."""
    return await build_dashboard(db, user)
