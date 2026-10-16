"""Silent corrections: stored during the talk, deduped and ranked for the recap."""

from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Correction
from app.schemas.sessions import NoteOut


async def count_corrections(db: AsyncSession, session_id: Any) -> int:
    n = await db.scalar(
        select(func.count()).select_from(Correction).where(Correction.session_id == session_id)
    )
    return int(n or 0)


async def list_corrections(db: AsyncSession, session_id: Any) -> list[Correction]:
    rows = await db.execute(
        select(Correction)
        .where(Correction.session_id == session_id)
        .order_by(Correction.created_at)
    )
    return list(rows.scalars().all())


def rank_corrections(rows: list[Correction]) -> list[NoteOut]:
    """Group repeats of the same slip, then order by severity and frequency."""
    groups: dict[tuple[str, str], list[Correction]] = {}
    for c in rows:
        groups.setdefault((c.you_said.strip().lower(), c.grammar_tag), []).append(c)

    ranked: list[tuple[int, int, NoteOut]] = []
    for (_, tag), items in groups.items():
        worst = max(items, key=lambda c: c.severity)
        note = NoteOut(
            you_said=worst.you_said,
            native_would_say=worst.native,
            why=worst.why,
            grammar_tag=tag,
            times=len(items),
        )
        ranked.append((worst.severity, len(items), note))
    ranked.sort(key=lambda t: (-t[0], -t[1]))
    return [note for _, _, note in ranked]
