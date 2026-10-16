from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

Level = Literal["A0", "A1", "A2", "B1", "B2", "C1", "C2"]  # A0 = just starting, below A1


class Settings(BaseSettings):
    """Runtime configuration from the environment or a .env file.

    Reads ../.env (repo root, shared with docker compose) then ./.env (api/),
    with the later file winning.
    """

    model_config = SettingsConfigDict(
        env_file=("../.env", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: Literal["dev", "test", "prod"] = "dev"
    database_url: str = "postgresql+asyncpg://yapster:yapster@localhost:5432/yapster"
    cors_origins: list[str] = ["http://localhost:3000"]
    # Dev convenience: also accept any private-network origin (the phone on the hotspot).
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


@lru_cache
def get_settings() -> Settings:
    return Settings()
