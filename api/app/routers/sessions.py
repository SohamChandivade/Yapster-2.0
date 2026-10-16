import uuid
from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select

from app.db.engine import get_session_factory
from app.db.models import Message, TalkSession, User
from app.deps import DB, CurrentUser, get_current_user, load_session
from app.llm.client import LLMClient, get_llm
from app.llm.types import LLMError
from app.scenarios import get_scenario
from app.schemas.sessions import (
    CorrectionItem,
    DifficultyRequest,
    DifficultyResponse,
    HelpRequest,
    HelpResponse,
    RecapResponse,
    SessionState,
    StartSessionRequest,
    StartSessionResponse,
    TranscriptLine,
    TurnRequest,
)
from app.services import recap_service, session_service
from app.services.correction_service import count_corrections, list_corrections

router = APIRouter(prefix="/sessions", tags=["sessions"], dependencies=[Depends(get_current_user)])
LLM = Annotated[LLMClient, Depends(get_llm)]


def _unavailable(err: Exception) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail=f"The tutor is unavailable right now: {err}",
    )


@router.post("", response_model=StartSessionResponse, status_code=status.HTTP_201_CREATED)
async def start(
    body: StartSessionRequest, db: DB, user: CurrentUser, llm: LLM
) -> StartSessionResponse:
    try:
        session, scenario, opening = await session_service.start_session(
            db, user, body.scenario, llm
        )
    except LLMError as err:
        raise _unavailable(err) from err
    return StartSessionResponse(
        session_id=session.id,
        scenario=scenario.slug,
        scenario_title=scenario.title,
        tutor_name=user.tutor_name,
        opening=opening,
        level=session_service.level_name(session.difficulty),
        difficulty=session.difficulty,
    )


@router.get("/{session_id}", response_model=SessionState)
async def state(session_id: uuid.UUID, db: DB, user: CurrentUser) -> SessionState:
    session = await load_session(db, user, session_id)
    scenario = get_scenario(session.scenario)
    rows = await db.execute(
        select(Message).where(Message.session_id == session.id).order_by(Message.seq)
    )
    return SessionState(
        session_id=session.id,
        scenario=scenario.slug,
        scenario_title=scenario.title,
        tutor_name=user.tutor_name,
        level=session_service.level_name(session.difficulty),
        difficulty=session.difficulty,
        started_at=session.started_at,
        ended=session.ended_at is not None,
        correction_count=await count_corrections(db, session.id),
        transcript=[
            TranscriptLine(id=m.id, role=m.role, text=m.text_de, assisted=m.assisted)
            for m in rows.scalars().all()
        ],
    )


@router.post("/{session_id}/turn")
async def turn(
    session_id: uuid.UUID, body: TurnRequest, db: DB, user: CurrentUser, llm: LLM
) -> StreamingResponse:
    """Server-sent events: `start`, `delta`*, then `done` or `error`."""
    session = await load_session(db, user, session_id)
    if session.ended_at is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Session already ended")
    user_id = user.id

    async def frames() -> AsyncIterator[str]:
        # The request-scoped db session may close before streaming ends; use our own.
        async with get_session_factory()() as sdb:
            s = await sdb.get(TalkSession, session_id)
            u = await sdb.get(User, user_id)
            assert s is not None and u is not None
            async for frame in session_service.stream_turn(
                sdb, u, s, body.text, body.assisted, llm
            ):
                yield frame

    return StreamingResponse(
        frames(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def discard(session_id: uuid.UUID, db: DB, user: CurrentUser) -> None:
    """Throw away a conversation that was never finished. Finished ones are history and stay."""
    session = await load_session(db, user, session_id)
    if session.ended_at is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Finished sessions cannot be discarded"
        )
    await db.delete(session)
    await db.commit()


@router.post("/{session_id}/help", response_model=HelpResponse)
async def help_me_say_this(
    session_id: uuid.UUID, body: HelpRequest, db: DB, user: CurrentUser, llm: LLM
) -> HelpResponse:
    session = await load_session(db, user, session_id)
    try:
        out = await session_service.help_phrase(session, body.english, llm)
    except LLMError as err:
        raise _unavailable(err) from err
    return HelpResponse(german=out.german.strip(), note=out.note.strip())


@router.post("/{session_id}/difficulty", response_model=DifficultyResponse)
async def difficulty(
    session_id: uuid.UUID, body: DifficultyRequest, db: DB, user: CurrentUser
) -> DifficultyResponse:
    session = await load_session(db, user, session_id)
    value = await session_service.nudge_difficulty(db, user, session, body.delta)
    return DifficultyResponse(difficulty=value, level=session_service.level_name(value))


@router.get("/{session_id}/corrections", response_model=list[CorrectionItem])
async def corrections(session_id: uuid.UUID, db: DB, user: CurrentUser) -> list[CorrectionItem]:
    session = await load_session(db, user, session_id)
    return [
        CorrectionItem(
            id=c.id,
            you_said=c.you_said,
            native=c.native,
            why=c.why,
            grammar_tag=c.grammar_tag,
            severity=c.severity,
        )
        for c in await list_corrections(db, session.id)
    ]


@router.post("/{session_id}/end", response_model=RecapResponse)
async def end(session_id: uuid.UUID, db: DB, user: CurrentUser, llm: LLM) -> RecapResponse:
    session = await load_session(db, user, session_id)
    return await recap_service.end_session(db, user, session, llm)


@router.get("/{session_id}/recap", response_model=RecapResponse)
async def recap(session_id: uuid.UUID, db: DB, user: CurrentUser) -> RecapResponse:
    session = await load_session(db, user, session_id)
    if session.ended_at is None or session.recap is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Session not ended yet")
    return recap_service.build_response(session, user)
