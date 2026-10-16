"""End-to-end API flow against the test database with the fake tutor."""

import json
from typing import Any

from httpx import AsyncClient

from tests.conftest import FakeLLM


def _events(body: str) -> list[tuple[str, Any]]:
    out: list[tuple[str, Any]] = []
    for frame in body.strip().split("\n\n"):
        event, data = "", "{}"
        for line in frame.splitlines():
            if line.startswith("event:"):
                event = line[6:].strip()
            elif line.startswith("data:"):
                data = line[5:].strip()
        out.append((event, json.loads(data)))
    return out


async def test_full_conversation_flow(db_client: AsyncClient, fake_llm: FakeLLM) -> None:
    # Start: opening line comes from the tutor, nothing from the learner yet.
    res = await db_client.post("/sessions", json={"scenario": "bakery"})
    assert res.status_code == 201, res.text
    start = res.json()
    sid = start["session_id"]
    assert start["opening"] == "Guten Morgen! Was darf es sein?"
    assert start["scenario_title"] == "Bakery" and start["level"] == "B1"

    # A turn streams deltas, then a done event with the silent correction counted.
    res = await db_client.post(f"/sessions/{sid}/turn", json={"text": "Ich möchte ein Brot"})
    assert res.status_code == 200
    assert res.headers["content-type"].startswith("text/event-stream")
    events = _events(res.text)
    assert events[0][0] == "start"
    deltas = "".join(d["text"] for e, d in events if e == "delta")
    assert deltas == fake_llm.turn.reply_de
    done = events[-1]
    assert done[0] == "done"
    assert done[1]["correction_count"] == 1 and done[1]["new_corrections"] == 1
    assert done[1]["level"] == "B2"  # difficulty_signal +1 nudged it up one notch
    assert done[1]["new_vocab"] == ["das Roggenbrot"]

    # State shows the whole transcript; corrections are stored but were never shown inline.
    state = (await db_client.get(f"/sessions/{sid}")).json()
    assert [m["role"] for m in state["transcript"]] == ["tutor", "user", "tutor"]
    assert state["correction_count"] == 1
    notes = (await db_client.get(f"/sessions/{sid}/corrections")).json()
    assert notes[0]["grammar_tag"] == "register"

    # Help me say this, then using it as an assisted line adds no corrections.
    res = await db_client.post(f"/sessions/{sid}/help", json={"english": "Could I have a bag?"})
    assert res.json()["german"].startswith("Könnte")
    res = await db_client.post(
        f"/sessions/{sid}/turn", json={"text": res.json()["german"], "assisted": True}
    )
    assert _events(res.text)[-1][1]["correction_count"] == 1

    # The learner can nudge difficulty by hand.
    res = await db_client.post(f"/sessions/{sid}/difficulty", json={"delta": -1})
    assert res.json()["level"] == "B1"

    # Recap is refused until the session ends.
    assert (await db_client.get(f"/sessions/{sid}/recap")).status_code == 409

    res = await db_client.post(f"/sessions/{sid}/end")
    assert res.status_code == 200, res.text
    recap = res.json()
    assert recap["fluency_score"] == 62
    assert recap["words_produced"] == 4  # only the learner's own line counts
    assert recap["notes"][0]["native_would_say"] == "Ich hätte gern ein Brot"
    assert recap["new_words"] == [{"word": "die Tüte", "gloss_en": "bag"}]
    assert "recap" in fake_llm.calls

    # Ending twice is idempotent and recap is now readable.
    assert (await db_client.post(f"/sessions/{sid}/end")).json() == recap
    assert (await db_client.get(f"/sessions/{sid}/recap")).json() == recap
    assert (await db_client.post(f"/sessions/{sid}/turn", json={"text": "x"})).status_code == 409

    # Saving words and reading stats.
    res = await db_client.post("/vocab/save", json={"session_id": sid, "words": ["die Tüte"]})
    assert res.json() == {"saved": 1, "total": 1}
    res = await db_client.post("/vocab/save", json={"session_id": sid, "words": ["die Tüte"]})
    assert res.json() == {"saved": 0, "total": 1}
    me = (await db_client.get("/me")).json()
    assert me["stats"]["sessions"] == 1 and me["stats"]["words_owned"] == 1
    assert me["stats"]["corrections"] == 1


async def test_turn_reports_tutor_outage_as_an_event(
    db_client: AsyncClient, fake_llm: FakeLLM
) -> None:
    sid = (await db_client.post("/sessions", json={})).json()["session_id"]
    fake_llm.fail_stream = True
    res = await db_client.post(f"/sessions/{sid}/turn", json={"text": "Hallo"})
    events = _events(res.text)
    assert events[-1][0] == "error"
    # The learner's line is still kept.
    state = (await db_client.get(f"/sessions/{sid}")).json()
    assert state["transcript"][-1]["text"] == "Hallo"


async def test_onboarding_seeds_memory_and_updates_profile(db_client: AsyncClient) -> None:
    res = await db_client.post(
        "/onboarding",
        json={"name": "Uli", "level": "A2", "comfort": "terrifying", "goals": ["travel"]},
    )
    assert res.status_code == 200
    assert res.json()["name"] == "Uli" and res.json()["level"] == "A2"
    me = (await db_client.get("/me")).json()
    assert me["user"]["goals"] == ["travel"]


async def test_scenarios_list(db_client: AsyncClient) -> None:
    res = await db_client.get("/scenarios")
    assert res.status_code == 200
    assert [s["slug"] for s in res.json()][:2] == ["bakery", "train"]


async def test_unknown_session_is_404(db_client: AsyncClient) -> None:
    res = await db_client.get("/sessions/00000000-0000-0000-0000-000000000000")
    assert res.status_code == 404


async def test_unfinished_session_can_be_discarded_but_finished_cannot(
    db_client: AsyncClient,
) -> None:
    sid = (await db_client.post("/sessions", json={"scenario": "bakery"})).json()["session_id"]
    await db_client.post(f"/sessions/{sid}/turn", json={"text": "Hallo"})
    assert (await db_client.delete(f"/sessions/{sid}")).status_code == 204
    assert (await db_client.get(f"/sessions/{sid}")).status_code == 404
    assert (await db_client.get("/dashboard")).json()["sessions_total"] == 0

    sid = (await db_client.post("/sessions", json={})).json()["session_id"]
    await db_client.post(f"/sessions/{sid}/end")
    assert (await db_client.delete(f"/sessions/{sid}")).status_code == 409
