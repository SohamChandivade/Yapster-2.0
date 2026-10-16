"""Google sign-in with Google itself replaced by a mock transport."""

import base64
import hashlib
from collections.abc import Iterator
from typing import Any
from urllib.parse import parse_qs, urlparse

import httpx
import pytest
from httpx import AsyncClient

from app.config import get_settings
from app.http import get_http
from app.main import app
from app.services import oauth_service
from tests.conftest import TEST_USER

GOOGLE = {
    "sub": "google-123",
    "email": "Uli@Example.com",
    "email_verified": True,
    "name": "Uli Example",
    "picture": "https://lh3.googleusercontent.com/a/photo",
}


@pytest.fixture
def google(monkeypatch: pytest.MonkeyPatch) -> Iterator[dict[str, Any]]:
    """Configure Google credentials and answer its token and userinfo endpoints."""
    s = get_settings()
    monkeypatch.setattr(s, "google_client_id", "client-id")
    monkeypatch.setattr(s, "google_client_secret", "client-secret")
    seen: dict[str, Any] = {"profile": dict(GOOGLE), "token_status": 200}

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url == oauth_service.TOKEN_URL:
            form = parse_qs(request.content.decode())
            seen["token_form"] = {k: v[0] for k, v in form.items()}
            status = int(seen["token_status"])
            body = {"access_token": "ya29.test"} if status == 200 else {"error": "invalid_grant"}
            return httpx.Response(status, json=body)
        if request.url == oauth_service.USERINFO_URL:
            assert request.headers["Authorization"] == "Bearer ya29.test"
            return httpx.Response(200, json=seen["profile"])
        return httpx.Response(404)

    mock = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    app.dependency_overrides[get_http] = lambda: mock
    yield seen
    app.dependency_overrides.pop(get_http, None)


def _fragment(location: str) -> dict[str, str]:
    return {k: v[0] for k, v in parse_qs(urlparse(location).fragment).items()}


async def _start(client: AsyncClient, return_to: str | None = None) -> tuple[str, dict[str, str]]:
    params = {"return_to": return_to} if return_to else {}
    res = await client.get("/auth/google/start", params=params)
    assert res.status_code == 302, res.text
    location = res.headers["location"]
    assert location.startswith(oauth_service.AUTH_URL)
    query = {k: v[0] for k, v in parse_qs(urlparse(location).query).items()}
    assert query["redirect_uri"] == "http://localhost:8000/auth/google/callback"
    assert query["code_challenge_method"] == "S256"
    cookie = res.cookies["yapster_oauth"]
    return cookie, query


async def test_providers_reflect_configuration(client: AsyncClient, google: dict[str, Any]) -> None:
    res = await client.get("/auth/providers")
    assert res.status_code == 200
    assert res.json() == {"google": {"enabled": True, "web_origin": "http://localhost:3000"}}


async def test_start_is_404_when_not_configured(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    s = get_settings()
    monkeypatch.setattr(s, "google_client_id", "")
    monkeypatch.setattr(s, "google_client_secret", "")
    assert (await client.get("/auth/google/start")).status_code == 404
    assert (await client.get("/auth/providers")).json()["google"]["enabled"] is False


async def test_full_google_sign_in_creates_an_account(
    client: AsyncClient, clean_db: None, google: dict[str, Any]
) -> None:
    cookie, query = await _start(client, return_to="http://localhost:3000")
    state, verifier, _ = cookie.split("|", 2)
    expected = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=")
    assert query["code_challenge"] == expected.decode()

    res = await client.get(
        "/auth/google/callback",
        params={"code": "auth-code", "state": state},
        headers={"Cookie": f"yapster_oauth={cookie}"},
    )
    assert res.status_code == 302, res.text
    location = res.headers["location"]
    assert location.startswith("http://localhost:3000/auth/callback#")
    frag = _fragment(location)
    assert frag["onboarded"] == "0"
    token_form = google["token_form"]
    assert isinstance(token_form, dict)
    assert token_form["code"] == "auth-code" and token_form["code_verifier"] == verifier

    me = await client.get("/me", headers={"Authorization": f"Bearer {frag['token']}"})
    assert me.status_code == 200
    user = me.json()["user"]
    assert user["email"] == "uli@example.com"
    assert user["name"] == "Uli Example"
    assert user["avatar_url"] == GOOGLE["picture"]


async def test_google_links_an_existing_email_account(
    client: AsyncClient, clean_db: None, google: dict[str, Any]
) -> None:
    reg = await client.post("/auth/register", json=TEST_USER)
    existing_id = reg.json()["user"]["id"]

    cookie, _ = await _start(client)
    state = cookie.split("|", 1)[0]
    res = await client.get(
        "/auth/google/callback",
        params={"code": "c", "state": state},
        headers={"Cookie": f"yapster_oauth={cookie}"},
    )
    frag = _fragment(res.headers["location"])
    me = await client.get("/me", headers={"Authorization": f"Bearer {frag['token']}"})
    assert me.json()["user"]["id"] == existing_id  # same account, now linked


async def test_callback_rejects_bad_state_and_unverified_email(
    client: AsyncClient, clean_db: None, google: dict[str, Any]
) -> None:
    cookie, _ = await _start(client)
    state = cookie.split("|", 1)[0]

    res = await client.get(
        "/auth/google/callback",
        params={"code": "c", "state": "forged"},
        headers={"Cookie": f"yapster_oauth={cookie}"},
    )
    assert res.status_code == 302 and "error=google" in res.headers["location"]
    assert "state_mismatch" in res.headers["location"]

    res = await client.get("/auth/google/callback", params={"error": "access_denied"})
    assert "reason=access_denied" in res.headers["location"]

    profile = google["profile"]
    assert isinstance(profile, dict)
    profile["email_verified"] = False
    res = await client.get(
        "/auth/google/callback",
        params={"code": "c", "state": state},
        headers={"Cookie": f"yapster_oauth={cookie}"},
    )
    assert "error=google" in res.headers["location"]

    google["token_status"] = 400
    profile["email_verified"] = True
    res = await client.get(
        "/auth/google/callback",
        params={"code": "c", "state": state},
        headers={"Cookie": f"yapster_oauth={cookie}"},
    )
    assert (
        "token+exchange+failed" in res.headers["location"]
        or "token%20exchange" in res.headers["location"]
    )
