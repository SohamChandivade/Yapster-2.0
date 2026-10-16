"""Session end (CLAUDE.md §6.4): minutes, words, ranked notes, one LLM pass for
fluency, positives and a next step. Memory extraction arrives in milestone 4."""

import logging
import re
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Message, TalkSession, User
from app.llm.client import LLMClient
from app.llm.prompts import RECAP_SYSTEM
from app.llm.types import ChatMessage, LLMError
from app.scenarios import get_scenario
from app.schemas.llm_outputs import RecapOut
from app.schemas.sessions import NoteOut, RecapResponse, WordOut
from app.services.correction_service import list_corrections, rank_corrections

log = logging.getLogger("yapster.recap")
_WORD = re.compile(r"[A-Za-zÄÖÜäöüß]+(?:-[A-Za-zÄÖÜäöüß]+)*")


def count_words(text: str) -> int:
    return len(_WORD.findall(text))


def build_response(session: TalkSession, user: User) -> RecapResponse:
    scenario = get_scenario(session.scenario)
    recap = session.recap or {}
    return RecapResponse(
        session_id=session.id,
        scenario=scenario.slug,
        scenario_title=scenario.title,
        tutor_name=user.tutor_name,
        minutes=session.minutes or 0.0,
        words_produced=int(recap.get("words_produced", 0)),
        fluency_score=session.fluency_score,
        summary=session.summary,
        notes=[NoteOut.model_validate(n) for n in recap.get("notes", [])],
        positives=list(recap.get("positives", [])),
        next_step=recap.get("next_step"),
        new_words=[WordOut.model_validate(w) for w in recap.get("new_words", [])],
    )


async def end_session(
    db: AsyncSession, user: User, session: TalkSession, llm: LLMClient
) -> RecapResponse:
    if session.ended_at is not None and session.recap is not None:
        return build_response(session, user)

    messages = list(
        (
            await db.execute(
                select(Message).where(Message.session_id == session.id).order_by(Message.seq)
            )
        )
        .scalars()
        .all()
    )
    own_lines = [m for m in messages if m.role == "user" and not m.assisted]
    words_produced = sum(count_words(m.text_de) for m in own_lines)
    now = datetime.now(UTC)
    minutes = round((now - session.started_at).total_seconds() / 60, 1)
    notes = rank_corrections(await list_corrections(db, session.id))

    judged: RecapOut | None = None
    if own_lines:
        transcript = "\n".join(
            f"{'Tutor' if m.role == 'tutor' else 'Learner'}"
            f"{' [assisted]' if m.assisted else ''}: {m.text_de}"
            for m in messages
        )
        try:
            judged, _ = await llm.complete_json(
                purpose="recap",
                chain=llm.batch_chain,
                system=RECAP_SYSTEM.format(level=user.level),
                messages=[ChatMessage("user", transcript)],
                schema=RecapOut,
                max_tokens=900,
                temperature=0.4,
            )
        except LLMError as err:
            log.warning("recap judgement failed for %s: %s", session.id, err)

    session.ended_at = now
    session.minutes = minutes
    session.fluency_score = judged.fluency_score if judged else None
    session.summary = judged.summary if judged else None
    session.recap = {
        "words_produced": words_produced,
        "notes": [n.model_dump() for n in notes],
        "positives": judged.positives if judged else [],
        "next_step": judged.next_step if judged else None,
        "new_words": [w.model_dump() for w in judged.new_words] if judged else [],
    }
    await db.commit()
    return build_response(session, user)
