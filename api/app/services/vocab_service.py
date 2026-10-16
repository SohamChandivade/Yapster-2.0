from typing import Any, cast

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.engine import CursorResult
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import TalkSession, User, Vocab


async def save_words(
    db: AsyncSession, user: User, session_id: Any, words: list[str]
) -> tuple[int, int]:
    """Upsert words into the learner's vocab. Returns (newly saved, total owned)."""
    glosses: dict[str, str] = {}
    if session_id is not None:
        session = await db.get(TalkSession, session_id)
        if session is not None and session.recap:
            for w in session.recap.get("new_words", []):
                glosses[str(w.get("word", "")).lower()] = str(w.get("gloss_en", ""))

    rows = [
        {
            "user_id": user.id,
            "word": w.strip(),
            "gloss_en": glosses.get(w.strip().lower()),
            "first_seen_session": session_id,
            "status": "new",
        }
        for w in dict.fromkeys(x.strip() for x in words if x.strip())
    ]
    saved = 0
    if rows:
        result = await db.execute(
            insert(Vocab).values(rows).on_conflict_do_nothing(constraint="uq_vocab_user_word")
        )
        saved = cast(CursorResult[Any], result).rowcount or 0
        await db.commit()
    total = await db.scalar(select(func.count()).select_from(Vocab).where(Vocab.user_id == user.id))
    return saved, int(total or 0)
