"""Provider-agnostic LLM client: ordered fallback chain, JSON output, retries,
timeouts, token logging. Every LLM call in the app goes through here."""

import asyncio
import json
import logging
import re
import time
from collections.abc import AsyncIterator, Awaitable, Callable
from typing import Any, TypeVar

import httpx
from pydantic import BaseModel

from app.config import Settings, get_settings
from app.llm import providers
from app.llm.reply_extractor import ReplyExtractor
from app.llm.types import CallInfo, ChatMessage, LLMError, LLMExhausted, ProviderSpec

log = logging.getLogger("yapster.llm")

T = TypeVar("T", bound=BaseModel)
OnCall = Callable[[CallInfo, str], Awaitable[None]]
StreamEvent = tuple[str, Any]  # ("delta", str) | ("final", (parsed, CallInfo))

RETRYABLE_STATUS = {408, 409, 425, 429, 500, 502, 503, 504}
_FAILURES = (LLMError, httpx.HTTPError, ValueError, KeyError, IndexError, TypeError)


def extract_json(text: str) -> Any:
    """Parse JSON, tolerating code fences or chatter around the object."""
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    match = re.search(r"\{.*\}", text, re.S)
    if not match:
        raise ValueError("no JSON object in response")
    return json.loads(match.group(0))


def parse_model[M: BaseModel](text: str, schema: type[M]) -> M:
    return schema.model_validate(extract_json(text))


def _ms(t0: float) -> int:
    return int((time.perf_counter() - t0) * 1000)


def _retryable(err: Exception) -> bool:
    if isinstance(err, LLMError):
        return err.retryable
    return isinstance(err, httpx.TimeoutException | httpx.TransportError)


class LLMClient:
    def __init__(
        self,
        settings: Settings | None = None,
        *,
        http: httpx.AsyncClient | None = None,
        on_call: OnCall | None = None,
    ) -> None:
        self.settings = settings or get_settings()
        self.http = http or httpx.AsyncClient(
            timeout=httpx.Timeout(self.settings.llm_timeout_s, connect=10.0)
        )
        self.on_call = on_call
        self.chat_chain = ProviderSpec.parse_chain(self.settings.llm_chat_chain)
        self.batch_chain = ProviderSpec.parse_chain(self.settings.llm_batch_chain)

    def _key(self, spec: ProviderSpec) -> str:
        s = self.settings
        keys = {"gemini": s.gemini_api_key, "groq": s.groq_api_key, "mistral": s.mistral_api_key}
        return keys[spec.provider]

    def _usable(self, chain: list[ProviderSpec]) -> list[ProviderSpec]:
        usable = [spec for spec in chain if self._key(spec)]
        if not usable:
            raise LLMExhausted("No LLM provider has an API key configured")
        return usable

    async def _record(self, info: CallInfo, purpose: str) -> None:
        if not info.ok:
            log.warning("llm %s %s/%s failed: %s", purpose, info.provider, info.model, info.error)
        if self.on_call is not None:
            await self.on_call(info, purpose)

    async def complete_json(
        self,
        *,
        purpose: str,
        chain: list[ProviderSpec],
        system: str,
        messages: list[ChatMessage],
        schema: type[T],
        max_tokens: int = 600,
        temperature: float = 0.7,
        response_schema: dict[str, Any] | None = None,
    ) -> tuple[T, CallInfo]:
        last: Exception | None = None
        for spec in self._usable(chain):
            for attempt in range(self.settings.llm_max_retries + 1):
                t0 = time.perf_counter()
                try:
                    req = providers.build_request(
                        spec,
                        self._key(spec),
                        system=system,
                        messages=messages,
                        max_tokens=max_tokens,
                        temperature=temperature,
                        stream=False,
                        response_schema=response_schema,
                    )
                    resp = await self.http.post(req.url, headers=req.headers, json=req.body)
                    if resp.status_code >= 400:
                        raise LLMError(
                            f"HTTP {resp.status_code}: {resp.text[:200]}",
                            retryable=resp.status_code in RETRYABLE_STATUS,
                            status=resp.status_code,
                        )
                    text, usage = providers.parse_full(spec, resp.json())
                    parsed = parse_model(text, schema)
                    info = CallInfo(
                        spec.provider,
                        spec.model,
                        _ms(t0),
                        True,
                        usage.prompt_tokens,
                        usage.completion_tokens,
                    )
                    await self._record(info, purpose)
                    return parsed, info
                except _FAILURES as err:
                    last = err
                    await self._record(
                        CallInfo(spec.provider, spec.model, _ms(t0), False, error=str(err)[:300]),
                        purpose,
                    )
                    if not _retryable(err) or attempt >= self.settings.llm_max_retries:
                        break
                    await asyncio.sleep(0.8 * (attempt + 1))
        raise LLMExhausted(f"All providers failed for {purpose}: {last}")

    async def stream_json(
        self,
        *,
        purpose: str,
        chain: list[ProviderSpec],
        system: str,
        messages: list[ChatMessage],
        schema: type[T],
        max_tokens: int = 600,
        temperature: float = 0.7,
        response_schema: dict[str, Any] | None = None,
        stream_field: str = "reply_de",
    ) -> AsyncIterator[StreamEvent]:
        """Yield ("delta", text) as stream_field arrives, then ("final", (parsed, info)).

        Falls through to the next provider only if nothing was emitted yet.
        """
        last: Exception | None = None
        for spec in self._usable(chain):
            t0 = time.perf_counter()
            extractor = ReplyExtractor(stream_field)
            emitted = False
            chunks: list[str] = []
            usage = providers.Usage()
            try:
                req = providers.build_request(
                    spec,
                    self._key(spec),
                    system=system,
                    messages=messages,
                    max_tokens=max_tokens,
                    temperature=temperature,
                    stream=True,
                    response_schema=response_schema,
                )
                async with self.http.stream(
                    "POST", req.url, headers=req.headers, json=req.body
                ) as resp:
                    if resp.status_code >= 400:
                        body = (await resp.aread()).decode(errors="replace")
                        raise LLMError(
                            f"HTTP {resp.status_code}: {body[:200]}",
                            retryable=resp.status_code in RETRYABLE_STATUS,
                            status=resp.status_code,
                        )
                    async for line in resp.aiter_lines():
                        payload = providers.sse_payload(line)
                        if not payload or payload == "[DONE]":
                            continue
                        delta, chunk_usage = providers.parse_chunk(spec, json.loads(payload))
                        if chunk_usage is not None:
                            usage = chunk_usage
                        if delta:
                            chunks.append(delta)
                            piece = extractor.feed(delta)
                            if piece:
                                emitted = True
                                yield ("delta", piece)
                parsed = parse_model("".join(chunks), schema)
                info = CallInfo(
                    spec.provider,
                    spec.model,
                    _ms(t0),
                    True,
                    usage.prompt_tokens,
                    usage.completion_tokens,
                )
                await self._record(info, purpose)
                yield ("final", (parsed, info))
                return
            except _FAILURES as err:
                last = err
                await self._record(
                    CallInfo(spec.provider, spec.model, _ms(t0), False, error=str(err)[:300]),
                    purpose,
                )
                if emitted:
                    raise LLMError(f"{spec.provider} failed mid-stream: {err}") from err
        raise LLMExhausted(f"All providers failed for {purpose}: {last}")


_client: LLMClient | None = None


def get_llm() -> LLMClient:
    """FastAPI dependency. Tests override it with a fake."""
    global _client
    if _client is None:
        from app.llm.recorder import record_call

        _client = LLMClient(on_call=record_call)
    return _client
