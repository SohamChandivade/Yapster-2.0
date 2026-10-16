from datetime import date

from httpx import AsyncClient

from app.services.progress_service import best_streak, week_start
from tests.conftest import FakeLLM


def test_best_streak_and_week_start() -> None:
    assert best_streak(set()) == 0
    assert best_streak({date(2026, 10, 1)}) == 1
    days = {
        date(2026, 10, 1),
        date(2026, 10, 2),
        date(2026, 10, 3),
        date(2026, 10, 7),
        date(2026, 10, 8),
    }
    assert best_streak(days) == 3
    assert week_start(date(2026, 10, 16)) == date(2026, 10, 12)  # a Friday → that Monday
    assert week_start(date(2026, 10, 12)) == date(2026, 10, 12)


async def test_progress_scenarios_and_resume_after_sessions(
    db_client: AsyncClient, fake_llm: FakeLLM
) -> None:
    empty = (await db_client.get("/progress")).json()
    assert len(empty["days"]) == 35 and all(d["sessions"] == 0 for d in empty["days"])
    assert empty["weak_spots"] == [] and len(empty["vocab"]) == 8 and empty["sessions"] == []
    assert empty["totals"] == {"sessions": 0, "minutes": 0.0, "words": 0, "corrections": 0}

    # An unfinished session shows up on the dashboard as resumable.
    sid = (await db_client.post("/sessions", json={"scenario": "bakery"})).json()["session_id"]
    await db_client.post(f"/sessions/{sid}/turn", json={"text": "Ich möchte ein Brot"})
    dash = (await db_client.get("/dashboard")).json()
    assert dash["open_session"]["session_id"] == sid
    assert dash["open_session"]["scenario_title"] == "Bakery"
    assert dash["open_session"]["turns"] == 1

    await db_client.post(f"/sessions/{sid}/end")
    await db_client.post("/vocab/save", json={"session_id": sid, "words": ["die Tüte"]})
    assert (await db_client.get("/dashboard")).json()["open_session"] is None

    p = (await db_client.get("/progress")).json()
    assert p["days"][-1]["sessions"] == 1 and p["days"][-1]["minutes"] >= 0
    assert p["streak_days"] == 1 and p["best_streak"] == 1
    assert len(p["weeks"]) == 4
    assert p["weak_spots"][0]["grammar_tag"] == "register"
    assert p["weak_spots"][0]["weekly"][-1] == 1 and p["weak_spots"][0]["total"] == 1
    assert p["vocab"][-1]["owned"] == 1 and p["vocab"][0]["owned"] == 0
    assert p["sessions"][0]["session_id"] == sid and p["sessions"][0]["notes"] == 1
    assert p["sessions"][0]["fluency_score"] == 62
    assert p["totals"]["sessions"] == 1 and p["totals"]["words"] == 1

    scenarios = (await db_client.get("/scenarios")).json()
    bakery = next(s for s in scenarios if s["slug"] == "bakery")
    assert bakery["played"] == 1 and bakery["last_played_at"] is not None
    assert next(s for s in scenarios if s["slug"] == "train")["played"] == 0
