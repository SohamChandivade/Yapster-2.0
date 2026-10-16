"""Numbers for the Home screen, all derived from real sessions, notes and vocab."""

from datetime import UTC, date, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Correction, TalkSession, User, Vocab
from app.scenarios import SCENARIOS, Scenario, get_scenario
from app.schemas.dashboard import DashboardResponse, LastSession, NextSession, WeakSpot
from app.schemas.users import UserOut

WEEKLY_GOAL_MINUTES = 60
GOAL_SCENARIO = {
    "work": "interview",
    "living": "landlord",
    "travel": "train",
    "exams": "free",
    "fun": "party",
}
GOAL_LABEL = {
    "work": "Work",
    "living": "Living in Germany",
    "travel": "Travel",
    "exams": "Exams",
    "fun": "Just because",
}


def streak_days(session_days: set[date], today: date) -> int:
    """Consecutive days with a finished session, counting back from today or yesterday."""
    if not session_days:
        return 0
    cursor = today if today in session_days else today - timedelta(days=1)
    streak = 0
    while cursor in session_days:
        streak += 1
        cursor -= timedelta(days=1)
    return streak


def pick_next(user: User, played: dict[str, int]) -> tuple[Scenario, str]:
    """First goal-matching scenario not yet played, else the least played scenario."""
    for goal in user.goals:
        slug = GOAL_SCENARIO.get(goal)
        if slug and played.get(slug, 0) == 0:
            return get_scenario(slug), f"Matches your goal: {GOAL_LABEL.get(goal, goal)}"
    least = min(SCENARIOS.values(), key=lambda s: (played.get(s.slug, 0), s.minutes))
    reason = (
        "You haven't tried this one yet" if played.get(least.slug, 0) == 0 else "Least practised"
    )
    return least, reason


async def build_dashboard(db: AsyncSession, user: User) -> DashboardResponse:
    now = datetime.now(UTC)
    week_ago = now - timedelta(days=7)

    ended = list(
        (
            await db.execute(
                select(TalkSession)
                .where(TalkSession.user_id == user.id, TalkSession.ended_at.is_not(None))
                .order_by(TalkSession.ended_at.desc())
            )
        )
        .scalars()
        .all()
    )
    session_days = {s.ended_at.astimezone(UTC).date() for s in ended if s.ended_at}
    minutes_week = sum((s.minutes or 0.0) for s in ended if s.ended_at and s.ended_at >= week_ago)

    played: dict[str, int] = {}
    for s in ended:
        played[s.scenario or "free"] = played.get(s.scenario or "free", 0) + 1
    next_scenario, reason = pick_next(user, played)

    last: LastSession | None = None
    if ended:
        s = ended[0]
        notes = await db.scalar(
            select(func.count()).select_from(Correction).where(Correction.session_id == s.id)
        )
        scenario = get_scenario(s.scenario)
        assert s.ended_at is not None
        last = LastSession(
            session_id=s.id,
            scenario=scenario.slug,
            scenario_title=scenario.title,
            minutes=s.minutes or 0.0,
            notes=int(notes or 0),
            fluency_score=s.fluency_score,
            ended_at=s.ended_at,
        )

    words_owned = await db.scalar(
        select(func.count()).select_from(Vocab).where(Vocab.user_id == user.id)
    )
    words_week = await db.scalar(
        select(func.count())
        .select_from(Vocab)
        .where(Vocab.user_id == user.id, Vocab.created_at >= week_ago)
    )

    weak: WeakSpot | None = None
    tag_row = (
        await db.execute(
            select(Correction.grammar_tag, func.count().label("n"))
            .join(TalkSession, TalkSession.id == Correction.session_id)
            .where(
                TalkSession.user_id == user.id, Correction.created_at >= now - timedelta(days=30)
            )
            .group_by(Correction.grammar_tag)
            .order_by(func.count().desc(), Correction.grammar_tag)
            .limit(1)
        )
    ).first()
    if tag_row is not None:
        example = await db.scalar(
            select(Correction.native)
            .join(TalkSession, TalkSession.id == Correction.session_id)
            .where(TalkSession.user_id == user.id, Correction.grammar_tag == tag_row.grammar_tag)
            .order_by(Correction.created_at.desc())
            .limit(1)
        )
        weak = WeakSpot(
            grammar_tag=tag_row.grammar_tag, count=int(tag_row.n), example_native=example
        )

    return DashboardResponse(
        user=UserOut.model_validate(user, from_attributes=True),
        day=(now.date() - user.created_at.astimezone(UTC).date()).days + 1,
        streak_days=streak_days(session_days, now.date()),
        minutes_last_7_days=round(minutes_week, 1),
        weekly_goal_minutes=WEEKLY_GOAL_MINUTES,
        sessions_total=len(ended),
        words_owned=int(words_owned or 0),
        words_last_7_days=int(words_week or 0),
        last_session=last,
        next_session=NextSession(
            scenario=next_scenario.slug,
            scenario_title=next_scenario.title,
            minutes=next_scenario.minutes,
            reason=reason,
        ),
        weak_spot=weak,
    )
