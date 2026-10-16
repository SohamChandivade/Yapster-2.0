from dataclasses import dataclass
from typing import Literal

Provider = Literal["gemini", "groq", "mistral"]
PROVIDERS: tuple[Provider, ...] = ("gemini", "groq", "mistral")


@dataclass(frozen=True)
class ProviderSpec:
    provider: Provider
    model: str

    @staticmethod
    def parse_chain(chain: str) -> list["ProviderSpec"]:
        """Parse "gemini:gemini-3.5-flash-lite,groq:qwen/qwen3.8-27b" into specs, in order."""
        specs: list[ProviderSpec] = []
        for raw in chain.split(","):
            item = raw.strip()
            if not item:
                continue
            provider, _, model = item.partition(":")
            if provider not in PROVIDERS or not model:
                raise ValueError(f"Bad LLM chain entry: {item!r}")
            specs.append(ProviderSpec(provider, model))
        if not specs:
            raise ValueError("LLM chain is empty")
        return specs


@dataclass(frozen=True)
class ChatMessage:
    role: Literal["user", "assistant"]
    content: str


@dataclass
class CallInfo:
    """What happened on one provider attempt. Persisted to llm_calls."""

    provider: str
    model: str
    latency_ms: int
    ok: bool
    prompt_tokens: int | None = None
    completion_tokens: int | None = None
    error: str | None = None


class LLMError(Exception):
    def __init__(self, message: str, *, retryable: bool = False, status: int | None = None):
        super().__init__(message)
        self.retryable = retryable
        self.status = status


class LLMExhausted(LLMError):
    """Every provider in the chain failed."""
