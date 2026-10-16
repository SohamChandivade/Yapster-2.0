from fastapi import APIRouter, Depends
from sqlalchemy import func, select

from app.db.models import Correction, Memory, TalkSession, Vocab
from app.deps import DB, CurrentUser, get_current_user
from app.schemas.users import MeResponse, OnboardingRequest, Stats, UserOut

router = APIRouter(tags=["users"], dependencies=[Depends(get_current_user)])

COMFORT_TEXT = {
    "terrifying": "finds speaking German terrifying; needs lots of encouragement",
    "awkward": "feels awkward speaking German; warms up slowly",
    "fine": "feels fine speaking German",
    "pretty_good": "feels pretty good speaking German; enjoys being stretched",
}


@router.post("/onboarding", response_model=UserOut)
async def onboarding(body: OnboardingRequest, db: DB, user: CurrentUser) -> UserOut:
    """v1 single-user: update the one profile and seed its memory with the answers."""
    user.name = body.name.strip()
    user.level = body.level
    user.comfort = body.comfort
    user.goals = body.goals
    user.tutor_name = body.tutor_name.strip() or "Lena"
    user.onboarded = True

    seeds = [("fact", COMFORT_TEXT[body.comfort])]
    seeds += [("goal", f"learning German for: {g}") for g in body.goals]
    existing = {
        m.text
        for m in (await db.execute(select(Memory).where(Memory.user_id == user.id))).scalars()
    }
    for kind, text in seeds:
        if text not in existing:
            db.add(Memory(user_id=user.id, kind=kind, text=text, weight=1.5))
    await db.commit()
    await db.refresh(user)
    return UserOut.model_validate(user, from_attributes=True)


@router.get("/me", response_model=MeResponse)
async def me(db: DB, user: CurrentUser) -> MeResponse:
    sessions = await db.scalar(
        select(func.count()).select_from(TalkSession).where(TalkSession.user_id == user.id)
    )
    minutes = await db.scalar(
        select(func.coalesce(func.sum(TalkSession.minutes), 0.0)).where(
            TalkSession.user_id == user.id
        )
    )
    words = await db.scalar(select(func.count()).select_from(Vocab).where(Vocab.user_id == user.id))
    corrections = await db.scalar(
        select(func.count())
        .select_from(Correction)
        .join(TalkSession, TalkSession.id == Correction.session_id)
        .where(TalkSession.user_id == user.id)
    )
    return MeResponse(
        user=UserOut.model_validate(user, from_attributes=True),
        stats=Stats(
            sessions=int(sessions or 0),
            minutes=round(float(minutes or 0.0), 1),
            words_owned=int(words or 0),
            corrections=int(corrections or 0),
        ),
    )
