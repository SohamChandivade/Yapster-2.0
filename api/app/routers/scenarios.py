from fastapi import APIRouter
from sqlalchemy import func, select

from app.db.models import TalkSession
from app.deps import DB, CurrentUser
from app.scenarios import SCENARIOS
from app.schemas.misc import ScenarioOut

router = APIRouter(tags=["scenarios"])


@router.get("/scenarios", response_model=list[ScenarioOut])
async def list_scenarios(db: DB, user: CurrentUser) -> list[ScenarioOut]:
    """The catalogue, with how often this learner has finished each scenario."""
    rows = await db.execute(
        select(TalkSession.scenario, func.count(), func.max(TalkSession.ended_at))
        .where(TalkSession.user_id == user.id, TalkSession.ended_at.is_not(None))
        .group_by(TalkSession.scenario)
    )
    played = {slug or "free": (int(n), last) for slug, n, last in rows.all()}
    return [
        ScenarioOut(
            slug=s.slug,
            title=s.title,
            blurb=s.blurb,
            minutes=s.minutes,
            played=played.get(s.slug, (0, None))[0],
            last_played_at=played.get(s.slug, (0, None))[1],
        )
        for s in SCENARIOS.values()
    ]
