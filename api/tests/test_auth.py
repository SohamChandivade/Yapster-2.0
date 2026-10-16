from httpx import AsyncClient

from tests.conftest import TEST_USER


def _bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def test_register_login_logout_cycle(client: AsyncClient, clean_db: None) -> None:
    res = await client.post("/auth/register", json={**TEST_USER, "email": "Uli@Example.com"})
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["user"]["email"] == "uli@example.com"
    assert body["user"]["onboarded"] is False
    assert body["user"]["name"] == "uli"
    token = body["token"]

    # Duplicates in any letter case are refused; weak passwords never reach the database.
    dup = await client.post("/auth/register", json=TEST_USER)
    assert dup.status_code == 409
    weak = await client.post("/auth/register", json={"email": "x@example.com", "password": "short"})
    assert weak.status_code == 422

    me = await client.get("/me", headers=_bearer(token))
    assert me.status_code == 200
    assert me.json()["user"]["email"] == "uli@example.com"

    # Login issues a second, independent token.
    res = await client.post("/auth/login", json=TEST_USER)
    assert res.status_code == 200
    token2 = res.json()["token"]
    assert token2 != token
    bad_pw = await client.post("/auth/login", json={**TEST_USER, "password": "wrong password"})
    assert bad_pw.status_code == 401
    unknown = await client.post(
        "/auth/login", json={"email": "nobody@example.com", "password": "whatever1"}
    )
    assert unknown.status_code == 401

    # Logout revokes only the presented token.
    assert (await client.post("/auth/logout", headers=_bearer(token))).status_code == 204
    assert (await client.get("/me", headers=_bearer(token))).status_code == 401
    assert (await client.get("/me", headers=_bearer(token2))).status_code == 200


async def test_protected_routes_need_a_valid_token(client: AsyncClient, clean_db: None) -> None:
    assert (await client.get("/me")).status_code == 401
    assert (await client.get("/scenarios", headers=_bearer("nope"))).status_code == 401
    assert (await client.post("/sessions", json={})).status_code == 401


async def test_onboarding_marks_the_user_onboarded(client: AsyncClient, clean_db: None) -> None:
    token = (await client.post("/auth/register", json=TEST_USER)).json()["token"]
    client.headers["Authorization"] = f"Bearer {token}"
    assert (await client.get("/me")).json()["user"]["onboarded"] is False
    res = await client.post(
        "/onboarding", json={"name": "Uli", "level": "B1", "comfort": "fine", "goals": ["work"]}
    )
    assert res.status_code == 200, res.text
    assert res.json()["onboarded"] is True
    assert res.json()["name"] == "Uli"
    assert (await client.get("/me")).json()["user"]["onboarded"] is True
