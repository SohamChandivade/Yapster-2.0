from datetime import date

from httpx import AsyncClient

from app.services.dashboard_service import streak_days
from tests.conftest import FakeLLM


def test_streak_counts_back_from_today_or_yesterday() -> None:
    today = date(2026, 10, 16)
    assert streak_days(set(), today) == 0
    assert streak_days({date(2026, 10, 16)}, today) == 1
    assert streak_days({date(2026, 10, 15), date(2026, 10, 14)}, today) == 2  # yesterday counts
    assert streak_days({date(2026, 10, 13)}, today) == 0  # broken
    assert streak_days({date(2026, 10, 16), date(2026, 10, 15), date(2026, 10, 13)}, today) == 2


async def test_dashboard_before_and_after_a_session(
    db_client: AsyncClient, fake_llm: FakeLLM
) -> None:
    res = await db_client.get("/dashboard")
    assert res.status_code == 200, res.text
    d = res.json()
    assert d["user"]["name"] == "Uli"
    assert d["day"] == 1 and d["streak_days"] == 0 and d["sessions_total"] == 0
    assert d["last_session"] is None and d["weak_spot"] is None
    # First goal is "work", nothing played yet → the interview scenario.
    assert d["next_session"]["scenario"] == "interview"
    assert "Work" in d["next_session"]["reason"]

    sid = (await db_client.post("/sessions", json={"scenario": "interview"})).json()["session_id"]
    await db_client.post(f"/sessions/{sid}/turn", json={"text": "Ich möchte ein Brot"})
    await db_client.post(f"/sessions/{sid}/end")
    await db_client.post("/vocab/save", json={"session_id": sid, "words": ["die Tüte"]})

    d = (await db_client.get("/dashboard")).json()
    assert d["sessions_total"] == 1 and d["streak_days"] == 1
    assert d["last_session"]["scenario"] == "interview" and d["last_session"]["notes"] == 1
    assert d["last_session"]["fluency_score"] == 62
    assert d["words_owned"] == 1 and d["words_last_7_days"] == 1
    assert d["weak_spot"] == {
        "grammar_tag": "register",
        "count": 1,
        "example_native": "Ich hätte gern ein Brot",
    }
    # Interview is done, so the suggestion moves on to something unplayed.
    assert d["next_session"]["scenario"] != "interview"
