"""Request builders and response parsers for each provider, over plain REST.

One code path, one retry policy, trivial to mock. Gemini has its own shape;
Groq and Mistral both speak the OpenAI chat-completions dialect.
"""

from dataclasses import dataclass
from typing import Any

from app.llm.types import ChatMessage, ProviderSpec

GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta"
GEMINI_THINKING_HEADROOM = 2048
OPENAI_BASES = {
    "groq": "https://api.groq.com/openai/v1",
    "mistral": "https://api.mistral.ai/v1",
}


@dataclass(frozen=True)
class HttpRequest:
    url: str
    headers: dict[str, str]
    body: dict[str, Any]


@dataclass
class Usage:
    prompt_tokens: int | None = None
    completion_tokens: int | None = None


def build_request(
    spec: ProviderSpec,
    api_key: str,
    *,
    system: str,
    messages: list[ChatMessage],
    max_tokens: int,
    temperature: float,
    stream: bool,
    response_schema: dict[str, Any] | None = None,
) -> HttpRequest:
    if spec.provider == "gemini":
        contents = [
            {"role": "user" if m.role == "user" else "model", "parts": [{"text": m.content}]}
            for m in messages
        ]
        gen: dict[str, Any] = {
            "responseMimeType": "application/json",
            # Gemini 3.x Flash thinks before answering and the thoughts count against
            # this cap, so leave headroom or the JSON gets truncated (Flash-Lite does not think).
            "maxOutputTokens": max_tokens + GEMINI_THINKING_HEADROOM,
            "temperature": temperature,
        }
        if response_schema:
            gen["responseSchema"] = response_schema
        body: dict[str, Any] = {
            "systemInstruction": {"parts": [{"text": system}]},
            "contents": contents,
            "generationConfig": gen,
        }
        method = "streamGenerateContent?alt=sse" if stream else "generateContent"
        return HttpRequest(
            f"{GEMINI_BASE}/models/{spec.model}:{method}", {"x-goog-api-key": api_key}, body
        )

    msgs: list[dict[str, str]] = [{"role": "system", "content": system}]
    msgs += [{"role": m.role, "content": m.content} for m in messages]
    body = {
        "model": spec.model,
        "messages": msgs,
        "response_format": {"type": "json_object"},
        "max_tokens": max_tokens,
        "temperature": temperature,
        "stream": stream,
    }
    if spec.model.startswith("openai/gpt-oss"):
        body["reasoning_effort"] = "low"  # otherwise reasoning eats the output budget
    return HttpRequest(
        f"{OPENAI_BASES[spec.provider]}/chat/completions",
        {"Authorization": f"Bearer {api_key}"},
        body,
    )


def parse_full(spec: ProviderSpec, data: dict[str, Any]) -> tuple[str, Usage]:
    """Text and usage from a non-streaming response. Raises KeyError on blocked/empty output."""
    if spec.provider == "gemini":
        parts = data["candidates"][0]["content"]["parts"]
        return "".join(p.get("text", "") for p in parts), _gemini_usage(data)
    choice = data["choices"][0]
    return choice["message"]["content"] or "", _openai_usage(data.get("usage"))


def parse_chunk(spec: ProviderSpec, data: dict[str, Any]) -> tuple[str, Usage | None]:
    """Delta text (may be empty) and usage if this chunk carries it."""
    if spec.provider == "gemini":
        text = "".join(
            p.get("text", "")
            for c in data.get("candidates", [])
            for p in (c.get("content") or {}).get("parts", [])
        )
        return text, (_gemini_usage(data) if "usageMetadata" in data else None)
    delta = "".join((c.get("delta") or {}).get("content") or "" for c in data.get("choices", []))
    usage = data.get("usage") or (data.get("x_groq") or {}).get("usage")
    return delta, (_openai_usage(usage) if usage else None)


def sse_payload(line: str) -> str | None:
    """The payload of a `data:` line in a server-sent-events stream, else None."""
    return line[5:].strip() if line.startswith("data:") else None


def _gemini_usage(data: dict[str, Any]) -> Usage:
    u = data.get("usageMetadata") or {}
    return Usage(u.get("promptTokenCount"), u.get("candidatesTokenCount"))


def _openai_usage(u: dict[str, Any] | None) -> Usage:
    u = u or {}
    return Usage(u.get("prompt_tokens"), u.get("completion_tokens"))
