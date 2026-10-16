from functools import lru_cache
from typing import Literal
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

Level = Literal["A0", "A1", "A2", "B1", "B2", "C1", "C2"]  # A0 = just starting, below A1


def normalize_database_url(url: str) -> str:
    """Accept the URL shapes hosted Postgres providers hand out and make them asyncpg-ready.

    - ``postgres://`` and ``postgresql://`` become ``postgresql+asyncpg://``.
    - ``sslmode`` and ``channel_binding`` (Neon, Render, Supabase) are libpq options, not
      asyncpg keywords: ``sslmode=require|verify-*`` becomes ``ssl=require``, ``disable``
      becomes ``ssl=disable``, and ``channel_binding`` is dropped.
    """
    parts = urlsplit(url)
    scheme = parts.scheme
    if scheme in ("postgres", "postgresql"):
        scheme = "postgresql+asyncpg"
    query = dict(parse_qsl(parts.query, keep_blank_values=True))
    sslmode = query.pop("sslmode", None)
    query.pop("channel_binding", None)
    if "ssl" not in query:
        if sslmode in ("require", "verify-ca", "verify-full"):
            query["ssl"] = "require"
        elif sslmode == "disable":
            query["ssl"] = "disable"
    return urlunsplit((scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))


class Settings(BaseSettings):
    """Runtime configuration from the environment or a .env file.

    Reads ../.env (repo root, shared with docker compose) then ./.env (api/),
    with the later file winning. Hosted runs (Render) set plain environment variables.
    """

    model_config = SettingsConfigDict(
        env_file=("../.env", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: Literal["dev", "test", "prod"] = "dev"
    database_url: str = "postgresql+asyncpg://yapster:yapster@localhost:5432/yapster"
    # The test suite creates and wipes a throwaway "yapster_test" database on this server.
    # Keep it local (docker compose) even when database_url points at a hosted database.
    test_database_url: str = "postgresql+asyncpg://yapster:yapster@localhost:5432/yapster"
    cors_origins: list[str] = ["http://localhost:3000"]
    # Dev convenience: also accept any private-network origin (the phone on the hotspot).
    # Set to false in production.
    cors_allow_private_networks: bool = True
    # Accounts: email + password, opaque bearer tokens (see services/auth_service.py).
    auth_token_days: int = 30
    default_tutor_name: str = "Lena"

    # Google sign-in (OAuth 2.0 authorization code + PKCE). Leave blank to hide the button.
    google_client_id: str = ""
    google_client_secret: str = ""
    # Where Google sends the browser back (must be registered in Google Cloud Console as
    # {public_api_url}/auth/google/callback) and where we send the user afterwards.
    public_api_url: str = "http://localhost:8000"
    public_web_url: str = "http://localhost:3000"

    # LLM providers. Chains are "provider:model" lists, tried in order.
    gemini_api_key: str = ""
    groq_api_key: str = ""
    mistral_api_key: str = ""
    llm_chat_chain: str = (
        "gemini:gemini-3.5-flash-lite,groq:qwen/qwen3.8-27b,mistral:ministral-14b-latest"
    )
    llm_batch_chain: str = (
        "gemini:gemini-3.8-flash,mistral:ministral-14b-latest,groq:openai/gpt-oss-120b"
    )
    llm_timeout_s: float = 30.0
    llm_max_retries: int = 1

    # Local sentence-transformers model dimension (multilingual-e5-small = 384).
    embedding_dim: int = 384

    @field_validator("database_url", "test_database_url")
    @classmethod
    def _asyncpg_url(cls, value: str) -> str:
        return normalize_database_url(value)


@lru_cache
def get_settings() -> Settings:
    return Settings()
