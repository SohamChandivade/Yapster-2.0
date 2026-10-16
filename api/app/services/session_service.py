"""The conversation loop (CLAUDE.md §6.3): build the prompt, stream the tutor's
reply, persist the turn and its silent corrections, nudge difficulty."""

import json
import logging
from collections.abc import AsyncIterator
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Correction, Memory, Message, TalkSession, User
from app.llm.client import LLMClient
from app.llm.prompts import (
    HELP_SYSTEM,
    HINT_SYSTEM,
    OPENING_REQUEST,
    REGISTER_BY_LEVEL,
    TUTOR_SYSTEM,
)
from app.llm.types import ChatMessage, LLMError
from app.scenarios import Scenario, get_scenario
from app.schemas.llm_outputs import HelpOut, HintOut, TutorTurn
from app.schemas.sessions import TurnDone
from app.services.correction_service import count_corrections

log = logging.getLogger("yapster.session")

# A0 = just starting, below A1. Index order matters: difficulty is stored as this index.
LEVELS = ["A0", "A1", "A2", "B1", "B2", "C1", "C2"]
HISTORY_MESSAGES = 12  # six exchanges; keeps live prompts small for Groq's 8K TPM
MAX_REPLY_TOKENS = 400


def level_index(level: str) -> int:
    return LEVELS.index(level) if level in LEVELS else LEVELS.index("B1")


def level_name(index: int) -> str:
    return LEVELS[max(0, min(len(LEVELS) - 1, index))]


def clamp_difficulty(value: int, user_level: str) -> int:
    """The tutor may drift one notch either side of the learner's own level."""
    base = level_index(user_level)
    return max(base - 1, min(base + 1, value, len(LEVELS) - 1), 0)


async def learner_facts(db: AsyncSession, user: User) -> str:
    rows = (
        (
            await db.execute(
                select(Memory)
                .where(Memory.user_id == user.id)
                .order_by(Memory.weight.desc())
                .limit(8)
            )
        )
        .scalars()
        .all()
    )
    lines = [
        f"- Name: {user.name}",
        f"- Goals: {', '.join(user.goals) if user.goals else 'not stated'}",
        f"- How speaking German feels to them: {user.comfort}",
        *[f"- {m.text}" for m in rows],
    ]
    return "What you know about this learner:\n" + "\n".join(lines)


def build_tutor_system(user: User, session: TalkSession, scenario: Scenario, facts: str) -> str:
    level = level_name(session.difficulty)
    return TUTOR_SYSTEM.format(
        tutor_name=user.tutor_name,
        learner_name=user.name,
        level=level,
        register=REGISTER_BY_LEVEL[level],
        scenario_script=scenario.script,
        learner_facts=facts,
    )


async def next_seq(db: AsyncSession, session_id: Any) -> int:
    current = await db.scalar(select(func.max(Message.seq)).where(Message.session_id == session_id))
    return 0 if current is None else current + 1


async def history(
    db: AsyncSession, session_id: Any, limit: int = HISTORY_MESSAGES
) -> list[Message]:
    rows = (
        (
            await db.execute(
                select(Message)
                .where(Message.session_id == session_id)
                .order_by(Message.seq.desc())
                .limit(limit)
            )
        )
        .scalars()
        .all()
    )
    return list(reversed(rows))


async def start_session(
    db: AsyncSession, user: User, scenario_slug: str | None, llm: LLMClient
) -> tuple[TalkSession, Scenario, Message]:
    """Create the session and persist the tutor's opening line."""
    scenario = get_scenario(scenario_slug)
    session = TalkSession(
        user_id=user.id, scenario=scenario.slug, difficulty=level_index(user.level)
    )
    db.add(session)
    await db.flush()

    system = build_tutor_system(user, session, scenario, await learner_facts(db, user))
    parsed, _ = await llm.complete_json(
        purpose="opening",
        chain=llm.chat_chain,
        system=system,
        messages=[ChatMessage("user", OPENING_REQUEST)],
        schema=TutorTurn,
        max_tokens=MAX_REPLY_TOKENS,
    )
    line = Message(
        session_id=session.id,
        seq=0,
        role="tutor",
        text_de=parsed.reply_de.strip(),
        text_en_hint=parsed.reply_en.strip() or None,
    )
    db.add(line)
    await db.commit()
    await db.refresh(session)
    await db.refresh(line)
    return session, scenario, line


def sse(event: str, data: Any) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


async def stream_turn(
    db: AsyncSession,
    user: User,
    session: TalkSession,
    text: str,
    assisted: bool,
    llm: LLMClient,
) -> AsyncIterator[str]:
    """Yield SSE frames: start, delta*, then done (or error)."""
    scenario = get_scenario(session.scenario)
    seq = await next_seq(db, session.id)
    user_msg = Message(
        session_id=session.id, seq=seq, role="user", text_de=text.strip(), assisted=assisted
    )
    db.add(user_msg)
    await db.commit()

    system = build_tutor_system(user, session, scenario, await learner_facts(db, user))
    messages = [
        ChatMessage("user" if m.role == "user" else "assistant", m.text_de)
        for m in await history(db, session.id)
    ]
    yield sse("start", {"message_id": str(user_msg.id)})

    try:
        async for kind, payload in llm.stream_json(
            purpose="turn",
            chain=llm.chat_chain,
            system=system,
            messages=messages,
            schema=TutorTurn,
            max_tokens=MAX_REPLY_TOKENS,
        ):
            if kind == "delta":
                yield sse("delta", {"text": payload})
                continue

            parsed, info = payload
            tutor_msg = Message(
                session_id=session.id,
                seq=seq + 1,
                role="tutor",
                text_de=parsed.reply_de.strip(),
                text_en_hint=parsed.reply_en.strip() or None,
            )
            db.add(tutor_msg)
            new_corrections = 0
            if not assisted:  # helper-produced lines are not the learner's own words
                for c in parsed.silent_corrections:
                    db.add(
                        Correction(
                            session_id=session.id,
                            message_id=user_msg.id,
                            you_said=c.you_said,
                            native=c.native,
                            why=c.why,
                            grammar_tag=c.grammar_tag,
                            severity=c.severity,
                        )
                    )
                    new_corrections += 1
            session.difficulty = clamp_difficulty(
                session.difficulty + parsed.difficulty_signal, user.level
            )
            await db.commit()
            done = TurnDone(
                message_id=tutor_msg.id,
                reply_de=tutor_msg.text_de,
                reply_en=tutor_msg.text_en_hint or "",
                correction_count=await count_corrections(db, session.id),
                new_corrections=new_corrections,
                difficulty=session.difficulty,
                level=level_name(session.difficulty),
                new_vocab=parsed.new_vocab,
                provider=info.provider,
                model=info.model,
            )
            yield sse("done", done.model_dump(mode="json"))
    except LLMError as err:
        log.warning("turn failed for session %s: %s", session.id, err)
        yield sse(
            "error", {"message": "The tutor is unavailable right now. Try again in a moment."}
        )


async def help_phrase(session: TalkSession, english: str, llm: LLMClient) -> HelpOut:
    scenario = get_scenario(session.scenario)
    system = HELP_SYSTEM.format(
        level=level_name(session.difficulty), scenario_script=scenario.script
    )
    parsed, _ = await llm.complete_json(
        purpose="help",
        chain=llm.chat_chain,
        system=system,
        messages=[ChatMessage("user", english.strip())],
        schema=HelpOut,
        max_tokens=200,
        temperature=0.3,
    )
    return parsed


async def nudge_difficulty(db: AsyncSession, user: User, session: TalkSession, delta: int) -> int:
    session.difficulty = clamp_difficulty(session.difficulty + delta, user.level)
    await db.commit()
    return session.difficulty


async def hint(
    db: AsyncSession,
    session: TalkSession,
    llm: LLMClient,
    message_id: Any | None = None,
) -> tuple[Message, HintOut]:
    """Translate a tutor line and suggest three replies. Defaults to the latest tutor line."""
    query = select(Message).where(Message.session_id == session.id, Message.role == "tutor")
    if message_id is not None:
        query = query.where(Message.id == message_id)
    target = (await db.execute(query.order_by(Message.seq.desc()).limit(1))).scalar_one_or_none()
    if target is None:
        raise LookupError("no tutor line to explain")

    scenario = get_scenario(session.scenario)
    level = level_name(session.difficulty)
    recent = [m for m in await history(db, session.id, limit=6) if m.seq <= target.seq]
    transcript = "\n".join(
        f"{'Tutor' if m.role == 'tutor' else 'Learner'}: {m.text_de}" for m in recent
    )
    parsed, _ = await llm.complete_json(
        purpose="hint",
        chain=llm.chat_chain,
        system=HINT_SYSTEM.format(
            level=level, register=REGISTER_BY_LEVEL[level], scenario_script=scenario.script
        ),
        messages=[
            ChatMessage(
                "user", f"Conversation so far:\n{transcript}\n\nTutor's last line: {target.text_de}"
            )
        ],
        schema=HintOut,
        max_tokens=400,
        temperature=0.5,
    )
    if not parsed.translation.strip() and target.text_en_hint:
        parsed.translation = target.text_en_hint
    return target, parsed
