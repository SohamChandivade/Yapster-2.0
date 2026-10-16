import json
from typing import Any

import httpx
import pytest
from pydantic import BaseModel

from app.config import Settings
from app.llm.client import LLMClient, extract_json
from app.llm.types import CallInfo, ChatMessage, LLMExhausted, ProviderSpec


class Out(BaseModel):
    reply_de: str
    n: int = 0


def _settings() -> Settings:
    return Settings(
        gemini_api_key="g-key",
        groq_api_key="q-key",
        mistral_api_key="",
        llm_max_retries=0,
        llm_chat_chain="gemini:gem-model,groq:groq-model,mistral:min-model",
    )


def _client(handler: Any) -> tuple[LLMClient, list[CallInfo]]:
    calls: list[CallInfo] = []

    async def on_call(info: CallInfo, purpose: str) -> None:
        calls.append(info)

    http = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    return LLMClient(_settings(), http=http, on_call=on_call), calls


def _openai_body(text: str) -> dict[str, Any]:
    return {
        "choices": [{"message": {"content": text}}],
        "usage": {"prompt_tokens": 12, "completion_tokens": 7},
    }


def test_parse_chain_validates_entries() -> None:
    assert ProviderSpec.parse_chain("gemini:a, groq:b") == [
        ProviderSpec("gemini", "a"),
        ProviderSpec("groq", "b"),
    ]
    with pytest.raises(ValueError):
        ProviderSpec.parse_chain("openai:gpt")


def test_extract_json_tolerates_fences_and_chatter() -> None:
    assert extract_json('Sure!\n```json\n{"a": 1}\n```') == {"a": 1}
    with pytest.raises(ValueError):
        extract_json("no json here")


async def test_falls_back_to_next_provider_on_429() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if "googleapis" in request.url.host:
            return httpx.Response(429, json={"error": "quota"})
        assert request.headers["Authorization"] == "Bearer q-key"
        return httpx.Response(200, json=_openai_body('{"reply_de": "Hallo", "n": 2}'))

    client, calls = _client(handler)
    parsed, info = await client.complete_json(
        purpose="t",
        chain=client.chat_chain,
        system="s",
        messages=[ChatMessage("user", "hi")],
        schema=Out,
    )
    assert parsed == Out(reply_de="Hallo", n=2)
    assert info.provider == "groq" and info.prompt_tokens == 12
    assert [(c.provider, c.ok) for c in calls] == [("gemini", False), ("groq", True)]


async def test_skips_providers_without_keys_and_raises_when_all_fail() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, text="boom")

    client, calls = _client(handler)
    with pytest.raises(LLMExhausted):
        await client.complete_json(
            purpose="t", chain=client.chat_chain, system="s", messages=[], schema=Out
        )
    assert [c.provider for c in calls] == ["gemini", "groq"]  # mistral has no key


async def test_streams_reply_field_then_final_parse() -> None:
    reply = {"reply_de": "Guten Tag, was darf es sein?", "n": 1}
    raw = json.dumps(reply)
    pieces = [raw[:8], raw[8:20], raw[20:]]
    sse = "".join(
        "data: " + json.dumps({"candidates": [{"content": {"parts": [{"text": p}]}}]}) + "\n\n"
        for p in pieces
    )
    sse += (
        "data: "
        + json.dumps({"usageMetadata": {"promptTokenCount": 30, "candidatesTokenCount": 9}})
        + "\n\n"
    )

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path.endswith(":streamGenerateContent")
        return httpx.Response(200, content=sse.encode())

    client, _ = _client(handler)
    deltas: list[str] = []
    final: Any = None
    async for kind, payload in client.stream_json(
        purpose="t", chain=client.chat_chain, system="s", messages=[], schema=Out
    ):
        if kind == "delta":
            deltas.append(payload)
        else:
            final = payload
    assert "".join(deltas) == reply["reply_de"]
    parsed, info = final
    assert parsed == Out(reply_de=reply["reply_de"], n=1)
    assert info.completion_tokens == 9


async def test_stream_falls_back_before_first_delta() -> None:
    body = _openai_body("")
    chunk = {"choices": [{"delta": {"content": '{"reply_de": "Servus"}'}}], "usage": body["usage"]}
    sse = "data: " + json.dumps(chunk) + "\n\ndata: [DONE]\n\n"

    def handler(request: httpx.Request) -> httpx.Response:
        if "googleapis" in request.url.host:
            return httpx.Response(503, text="overloaded")
        return httpx.Response(200, content=sse.encode())

    client, calls = _client(handler)
    events = [
        e
        async for e in client.stream_json(
            purpose="t", chain=client.chat_chain, system="s", messages=[], schema=Out
        )
    ]
    assert events[0] == ("delta", "Servus")
    assert events[-1][0] == "final" and events[-1][1][1].provider == "groq"
    assert [(c.provider, c.ok) for c in calls] == [("gemini", False), ("groq", True)]
