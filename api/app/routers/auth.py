import logging
import secrets
from typing import Annotated
from urllib.parse import quote, unquote

import httpx
from fastapi import APIRouter, Cookie, Depends, Header, HTTPException, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, EmailStr, Field

from app.config import get_settings
from app.deps import DB, Credentials, CurrentUser
from app.http import get_http
from app.origins import is_allowed_origin
from app.schemas.users import UserOut
from app.services import auth_service, oauth_service

log = logging.getLogger("yapster.auth")
router = APIRouter(prefix="/auth", tags=["auth"])

UserAgent = Annotated[str | None, Header()]
Http = Annotated[httpx.AsyncClient, Depends(get_http)]
OAUTH_COOKIE = "yapster_oauth"


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: str | None = Field(default=None, max_length=80)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class AuthResponse(BaseModel):
    token: str
    user: UserOut


class GoogleProvider(BaseModel):
    enabled: bool
    web_origin: str


class ProvidersResponse(BaseModel):
    google: GoogleProvider


def _auth_response(token: str, user: object) -> AuthResponse:
    return AuthResponse(token=token, user=UserOut.model_validate(user, from_attributes=True))


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest, db: DB, user_agent: UserAgent = None) -> AuthResponse:
    try:
        user = await auth_service.register(db, body.email, body.password, body.name)
    except auth_service.EmailTaken as err:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        ) from err
    return _auth_response(await auth_service.issue_token(db, user, user_agent), user)


@router.post("/login", response_model=AuthResponse)
async def login(body: LoginRequest, db: DB, user_agent: UserAgent = None) -> AuthResponse:
    user = await auth_service.authenticate(db, body.email, body.password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email or password is incorrect.",
        )
    return _auth_response(await auth_service.issue_token(db, user, user_agent), user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(db: DB, _: CurrentUser, creds: Credentials) -> None:
    """Revoke the presented token only; other devices stay signed in."""
    assert creds is not None  # guaranteed by CurrentUser
    await auth_service.revoke_token(db, creds.credentials)


# ── Google ───────────────────────────────────────────────────────────────


@router.get("/providers", response_model=ProvidersResponse)
async def providers() -> ProvidersResponse:
    """Public: which sign-in methods exist and from which web origin they complete."""
    s = get_settings()
    return ProvidersResponse(
        google=GoogleProvider(
            enabled=oauth_service.is_configured(s), web_origin=s.public_web_url.rstrip("/")
        )
    )


def _web_url(path: str, return_to: str | None = None) -> str:
    base = (return_to or get_settings().public_web_url).rstrip("/")
    return f"{base}{path}"


@router.get("/google/start", status_code=status.HTTP_302_FOUND)
async def google_start(return_to: str | None = None) -> RedirectResponse:
    """Send the browser to Google. State and the PKCE verifier ride in a short-lived cookie."""
    if not oauth_service.is_configured():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Google sign-in is off")
    origin = (return_to or "").rstrip("/")
    if origin and not is_allowed_origin(origin):
        origin = ""
    state = secrets.token_urlsafe(24)
    verifier, challenge = oauth_service.make_pkce()
    resp = RedirectResponse(
        oauth_service.build_authorize_url(state, challenge), status_code=status.HTTP_302_FOUND
    )
    resp.set_cookie(
        OAUTH_COOKIE,
        # Percent-encode the origin so the cookie value never needs quoting.
        f"{state}|{verifier}|{quote(origin, safe='')}",
        max_age=600,
        httponly=True,
        samesite="lax",
        secure=get_settings().public_api_url.startswith("https://"),
        path="/auth/google",
    )
    return resp


@router.get("/google/callback", status_code=status.HTTP_302_FOUND)
async def google_callback(
    db: DB,
    http: Http,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    user_agent: UserAgent = None,
    oauth_cookie: Annotated[str | None, Cookie(alias=OAUTH_COOKIE)] = None,
) -> RedirectResponse:
    """Google sends the browser here. On any failure, bounce to the login page with a reason."""
    expected_state, verifier, return_to = (oauth_cookie or "||").split("|", 2)
    return_to = unquote(return_to)

    def fail(reason: str) -> RedirectResponse:
        log.warning("google sign-in failed: %s", reason)
        resp = RedirectResponse(
            _web_url(f"/login?error=google&reason={quote(reason)}", return_to or None),
            status_code=status.HTTP_302_FOUND,
        )
        resp.delete_cookie(OAUTH_COOKIE, path="/auth/google")
        return resp

    if error:
        return fail(error)
    if not code or not state or not expected_state or not verifier:
        return fail("missing_state")
    if not secrets.compare_digest(state, expected_state):
        return fail("state_mismatch")

    try:
        profile = await oauth_service.exchange_code(http, code, verifier)
        user, created = await oauth_service.find_or_create_user(db, profile)
    except oauth_service.OAuthError as err:
        return fail(str(err)[:80])

    token = await auth_service.issue_token(db, user, user_agent)
    log.info("google sign-in ok for user %s (created=%s)", user.id, created)
    resp = RedirectResponse(
        _web_url(
            f"/auth/callback#token={token}&onboarded={int(user.onboarded)}", return_to or None
        ),
        status_code=status.HTTP_302_FOUND,
    )
    resp.delete_cookie(OAUTH_COOKIE, path="/auth/google")
    return resp
