from fastapi import APIRouter, Depends

from app.deps import get_current_user
from app.scenarios import SCENARIOS
from app.schemas.misc import ScenarioOut

router = APIRouter(tags=["scenarios"], dependencies=[Depends(get_current_user)])


@router.get("/scenarios", response_model=list[ScenarioOut])
async def list_scenarios() -> list[ScenarioOut]:
    return [
        ScenarioOut(slug=s.slug, title=s.title, blurb=s.blurb, minutes=s.minutes)
        for s in SCENARIOS.values()
    ]
