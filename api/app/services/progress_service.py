"""Numbers for the Progress screen: calendar, streaks, weak-spot trend, vocab growth, history."""

from collections import Counter, defaultdict
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Correction, TalkSession, User, Vocab
from app.scenarios import get_scenario
from app.schemas.progress import (
    DayCell,
    ProgressResponse,
    SessionRow,
    TagTrend,
    Totals,
    VocabPoint,
)
from app.services.dashboard_service import streak_days

CALENDAR_DAYS = 35
TAG_WEEKS = 4
TAG_SERIES = 4
VOCAB_WEEKS = 8
HISTORY_ROWS = 20


def week_start(d: date) -> date:
    return d - timedelta(days=d.weekday())  # Monday


def best_streak(session_days: set[date]) -> int:
    best = 0
    for d in session_days:
        if d - timedelta(days=1) in session_days:
            continue  # not the start of a run
        length = 1
        while d + timedelta(days=length) in session_days:
            length += 1
        best = max(best, length)
    return best


async def build_progress(db: AsyncSession, user: User) -> ProgressResponse:
    now = datetime.now(UTC)
    today = now.date()

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
    by_day: dict[date, DayCell] = {}
    for s in ended:
        assert s.ended_at is not None
        d = s.ended_at.astimezone(UTC).date()
        cell = by_day.get(d) or DayCell(date=d, minutes=0.0, sessions=0)
        by_day[d] = DayCell(
            date=d, minutes=round(cell.minutes + (s.minutes or 0.0), 1), sessions=cell.sessions + 1
        )
    session_days = set(by_day)
    first_day = today - timedelta(days=CALENDAR_DAYS - 1)
    days = [
        by_day.get(d) or DayCell(date=d, minutes=0.0, sessions=0)
        for d in (first_day + timedelta(days=i) for i in range(CALENDAR_DAYS))
    ]

    # Weak spots: corrections of the last TAG_WEEKS weeks, counted per tag and per week.
    weeks = [week_start(today) - timedelta(weeks=TAG_WEEKS - 1 - i) for i in range(TAG_WEEKS)]
    tag_rows = (
        await db.execute(
            select(Correction.grammar_tag, Correction.created_at)
            .join(TalkSession, TalkSession.id == Correction.session_id)
            .where(TalkSession.user_id == user.id, Correction.created_at >= weeks[0])
        )
    ).all()
    per_tag: dict[str, list[int]] = defaultdict(lambda: [0] * TAG_WEEKS)
    for tag, created in tag_rows:
        w = week_start(created.astimezone(UTC).date())
        if w in weeks:
            per_tag[tag][weeks.index(w)] += 1
    ranked = sorted(per_tag.items(), key=lambda kv: (-sum(kv[1]), kv[0]))
    weak_spots = [
        TagTrend(grammar_tag=tag, total=sum(counts), weekly=counts)
        for tag, counts in ranked[:TAG_SERIES]
    ]
    if len(ranked) > TAG_SERIES:
        rest = [0] * TAG_WEEKS
        for _, counts in ranked[TAG_SERIES:]:
            rest = [a + b for a, b in zip(rest, counts, strict=True)]
        weak_spots.append(TagTrend(grammar_tag="other", total=sum(rest), weekly=rest))

    # Vocab: cumulative words owned at the end of each of the last VOCAB_WEEKS weeks.
    vocab_dates = [
        d.astimezone(UTC).date()
        for (d,) in (
            await db.execute(select(Vocab.created_at).where(Vocab.user_id == user.id))
        ).all()
    ]
    vocab_weeks = [
        week_start(today) - timedelta(weeks=VOCAB_WEEKS - 1 - i) for i in range(VOCAB_WEEKS)
    ]
    vocab = [
        VocabPoint(week_start=w, owned=sum(1 for d in vocab_dates if d < w + timedelta(days=7)))
        for w in vocab_weeks
    ]

    # History with note counts.
    recent = ended[:HISTORY_ROWS]
    note_counts: Counter[object] = Counter()
    if recent:
        rows = await db.execute(
            select(Correction.session_id, func.count())
            .where(Correction.session_id.in_([s.id for s in recent]))
            .group_by(Correction.session_id)
        )
        note_counts = Counter({sid: int(n) for sid, n in rows.all()})
    sessions = []
    for s in recent:
        assert s.ended_at is not None
        scenario = get_scenario(s.scenario)
        sessions.append(
            SessionRow(
                session_id=s.id,
                scenario=scenario.slug,
                scenario_title=scenario.title,
                ended_at=s.ended_at,
                minutes=s.minutes or 0.0,
                notes=note_counts[s.id],
                fluency_score=s.fluency_score,
            )
        )

    corrections_total = await db.scalar(
        select(func.count())
        .select_from(Correction)
        .join(TalkSession, TalkSession.id == Correction.session_id)
        .where(TalkSession.user_id == user.id)
    )

    return ProgressResponse(
        days=days,
        streak_days=streak_days(session_days, today),
        best_streak=best_streak(session_days),
        weeks=weeks,
        weak_spots=weak_spots,
        vocab=vocab,
        sessions=sessions,
        totals=Totals(
            sessions=len(ended),
            minutes=round(sum((s.minutes or 0.0) for s in ended), 1),
            words=len(vocab_dates),
            corrections=int(corrections_total or 0),
        ),
    )
