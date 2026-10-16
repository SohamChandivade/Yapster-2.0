import logging

from app.db.engine import get_session_factory
from app.db.models import LLMCall
from app.llm.types import CallInfo

log = logging.getLogger("yapster.llm")


async def record_call(info: CallInfo, purpose: str) -> None:
    """Persist one provider attempt. Never lets bookkeeping break a conversation turn."""
    try:
        async with get_session_factory()() as db:
            db.add(
                LLMCall(
                    purpose=purpose,
                    provider=info.provider,
                    model=info.model,
                    prompt_tokens=info.prompt_tokens,
                    completion_tokens=info.completion_tokens,
                    latency_ms=info.latency_ms,
                    ok=info.ok,
                    error=info.error,
                )
            )
            await db.commit()
    except Exception:
        log.exception("could not record llm call")
