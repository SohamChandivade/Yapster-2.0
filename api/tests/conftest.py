"""Test wiring: a throwaway Postgres database, a registered user, and a fake LLM."""

import os
import re
from collections.abc import AsyncIterator, Iterator
from typing import Any

import asyncpg
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from app.config import Settings, get_settings

# Point the app at a throwaway database before anything caches settings.
_BASE_URL = Settings().database_url
TEST_DB = "yapster_test"
os.environ["DATABASE_URL"] = re.sub(r"/[^/?]+(\?.*)?$", f"/{TEST_DB}", _BASE_URL)
os.environ["APP_ENV"] = "test"
get_settings.cache_clear()

from app.db.base import Base  # noqa: E402
from app.db.engine import dispose_engine, get_engine  # noqa: E402
from app.llm.client import get_llm  # noqa: E402
from app.llm.types import CallInfo, LLMExhausted, ProviderSpec  # noqa: E402
from app.main import app  # noqa: E402
from app.schemas.llm_outputs import (  # noqa: E402
    HelpOut,
    HintOut,
    NewWord,
    RecapOut,
    SilentCorrection,
    Suggestion,
    TutorTurn,
)

TEST_USER = {"email": "uli@example.com", "password": "correct horse battery"}
TEST_PROFILE = {"name": "Uli", "level": "B1", "comfort": "awkward", "goals": ["work"]}


@pytest.fixture(scope="session")
async def database() -> AsyncIterator[None]:
    """Create the test database once per run; skip DB tests if Postgres is down."""
    dsn = _BASE_URL.replace("postgresql+asyncpg://", "postgresql://")
    try:
        conn = await asyncpg.connect(dsn, timeout=3)
    except Exception as err:
        pytest.skip(f"Postgres not reachable: {err}")
    try:
        if not await conn.fetchval("select 1 from pg_database where datname=$1", TEST_DB):
            await conn.execute(f'create database "{TEST_DB}"')
    finally:
        await conn.close()
    engine = get_engine()
    async with engine.begin() as c:
        await c.execute(text("create extension if not exists vector"))
        await c.run_sync(Base.metadata.drop_all)
        await c.run_sync(Base.metadata.create_all)
    yield
    await dispose_engine()


@pytest.fixture
async def clean_db(database: None) -> AsyncIterator[None]:
    names = ", ".join(f'"{t.name}"' for t in Base.metadata.sorted_tables)
    async with get_engine().begin() as c:
        await c.execute(text(f"truncate {names} cascade"))
    yield


@pytest.fixture
async def client() -> AsyncIterator[AsyncClient]:
    """Unauthenticated client against the ASGI app."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


class FakeLLM:
    """Stands in for LLMClient: canned outputs, records purposes, can fail on demand."""

    def __init__(self) -> None:
        self.chat_chain = [ProviderSpec("gemini", "fake-chat")]
        self.batch_chain = [ProviderSpec("mistral", "fake-batch")]
        self.calls: list[str] = []
        self.fail_stream = False
        self.opening = TutorTurn(
            reply_de="Guten Morgen! Was darf es sein?", reply_en="Good morning! What can I get you?"
        )
        self.turn = TutorTurn(
            reply_de="Gern, ein Roggenbrot. Soll ich es schneiden?",
            reply_en="Sure, a rye bread. Shall I slice it?",
            difficulty_signal=1,
            silent_corrections=[
                SilentCorrection(
                    you_said="Ich möchte ein Brot",
                    native="Ich hätte gern ein Brot",
                    why="'Hätte gern' is the usual polite form when ordering.",
                    grammar_tag="register",
                    severity=1,
                )
            ],
            new_vocab=["das Roggenbrot"],
        )
        self.help = HelpOut(german="Könnte ich bitte eine Tüte haben?", note="Polite conditional.")
        self.hint = HintOut(
            translation="Sure, a rye bread. Shall I slice it?",
            suggestions=[
                Suggestion(german="Ja, bitte.", english="Yes, please."),
                Suggestion(german="Nein, am Stück, bitte.", english="No, whole, please."),
                Suggestion(german="Was kostet das?", english="How much is it?"),
            ],
            tip="She is asking whether to slice the bread; a short yes or no is enough.",
        )
        self.recap = RecapOut(
            fluency_score=62,
            summary="Du hast Brot gekauft.",
            positives=["You used 'hätte gern' naturally."],
            next_step="Try asking one follow-up question yourself.",
            new_words=[NewWord(word="die Tüte", gloss_en="bag")],
        )

    async def complete_json(
        self, *, purpose: str, schema: type[Any], **_: Any
    ) -> tuple[Any, CallInfo]:
        self.calls.append(purpose)
        info = CallInfo("fake", "fake-model", 5, True, 10, 5)
        if schema is TutorTurn:
            return (self.opening if purpose == "opening" else self.turn), info
        if schema is HintOut:
            return self.hint, info
        if schema is HelpOut:
            return self.help, info
        return self.recap, info

    async def stream_json(self, *, purpose: str, **_: Any) -> AsyncIterator[tuple[str, Any]]:
        self.calls.append(purpose)
        if self.fail_stream:
            raise LLMExhausted("all providers down")
        reply = self.turn.reply_de
        for i in range(0, len(reply), 7):
            yield ("delta", reply[i : i + 7])
        yield ("final", (self.turn, CallInfo("fake", "fake-model", 5, True, 10, 5)))


@pytest.fixture
def fake_llm() -> Iterator[FakeLLM]:
    fake = FakeLLM()
    app.dependency_overrides[get_llm] = lambda: fake
    yield fake
    app.dependency_overrides.pop(get_llm, None)


@pytest.fixture
async def db_client(client: AsyncClient, clean_db: None, fake_llm: FakeLLM) -> AsyncClient:
    """A registered, onboarded, signed-in user against a clean database with the fake tutor."""
    res = await client.post("/auth/register", json=TEST_USER)
    assert res.status_code == 201, res.text
    client.headers["Authorization"] = f"Bearer {res.json()['token']}"
    res = await client.post("/onboarding", json=TEST_PROFILE)
    assert res.status_code == 200, res.text
    return client
