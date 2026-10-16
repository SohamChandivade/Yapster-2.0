"""Google sign-in: OAuth 2.0 authorization code flow with PKCE, over plain REST.

The API owns the whole dance. The browser is sent to Google, comes back to
/auth/google/callback, we exchange the code for the profile, find or create the
account, mint one of our own bearer tokens and hand it to the web app in a URL
fragment (fragments never reach servers or logs).
"""

import base64
import hashlib
import secrets
from dataclasses import dataclass
from urllib.parse import urlencode

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.db.models import User
from app.services.auth_service import normalize_email

AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"
SCOPES = "openid email profile"


class OAuthError(Exception):
    pass


@dataclass(frozen=True)
class GoogleProfile:
    sub: str
    email: str
    email_verified: bool
    name: str
    picture: str | None


def is_configured(settings: Settings | None = None) -> bool:
    s = settings or get_settings()
    return bool(s.google_client_id and s.google_client_secret)


def redirect_uri(settings: Settings | None = None) -> str:
    s = settings or get_settings()
    return f"{s.public_api_url.rstrip('/')}/auth/google/callback"


def make_pkce() -> tuple[str, str]:
    """Return (code_verifier, code_challenge) per RFC 7636, S256."""
    verifier = secrets.token_urlsafe(48)
    digest = hashlib.sha256(verifier.encode()).digest()
    challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode()
    return verifier, challenge


def build_authorize_url(state: str, code_challenge: str, settings: Settings | None = None) -> str:
    s = settings or get_settings()
    params = {
        "client_id": s.google_client_id,
        "redirect_uri": redirect_uri(s),
        "response_type": "code",
        "scope": SCOPES,
        "state": state,
        "code_challenge": code_challenge,
        "code_challenge_method": "S256",
        "access_type": "online",
        "prompt": "select_account",
    }
    return f"{AUTH_URL}?{urlencode(params)}"


async def exchange_code(
    http: httpx.AsyncClient, code: str, code_verifier: str, settings: Settings | None = None
) -> GoogleProfile:
    """Swap the authorization code for tokens, then fetch the verified profile."""
    s = settings or get_settings()
    token_res = await http.post(
        TOKEN_URL,
        data={
            "code": code,
            "client_id": s.google_client_id,
            "client_secret": s.google_client_secret,
            "redirect_uri": redirect_uri(s),
            "grant_type": "authorization_code",
            "code_verifier": code_verifier,
        },
    )
    if token_res.status_code != 200:
        raise OAuthError(f"token exchange failed: {token_res.status_code} {token_res.text[:200]}")
    access_token = token_res.json().get("access_token")
    if not access_token:
        raise OAuthError("token exchange returned no access_token")

    info_res = await http.get(USERINFO_URL, headers={"Authorization": f"Bearer {access_token}"})
    if info_res.status_code != 200:
        raise OAuthError(f"userinfo failed: {info_res.status_code}")
    info = info_res.json()
    sub, email = info.get("sub"), info.get("email")
    if not sub or not email:
        raise OAuthError("userinfo missing sub or email")
    return GoogleProfile(
        sub=str(sub),
        email=normalize_email(str(email)),
        email_verified=bool(info.get("email_verified", False)),
        name=str(info.get("name") or info.get("given_name") or email.split("@", 1)[0]),
        picture=info.get("picture"),
    )


async def find_or_create_user(db: AsyncSession, profile: GoogleProfile) -> tuple[User, bool]:
    """Match by Google id, else link a same-email account, else create. Returns (user, created)."""
    user = (
        await db.execute(select(User).where(User.google_sub == profile.sub))
    ).scalar_one_or_none()
    if user is not None:
        if profile.picture and user.avatar_url != profile.picture:
            user.avatar_url = profile.picture
            await db.commit()
        return user, False

    if not profile.email_verified:
        raise OAuthError("Google has not verified this email address")

    user = (await db.execute(select(User).where(User.email == profile.email))).scalar_one_or_none()
    if user is not None:
        user.google_sub = profile.sub
        user.avatar_url = profile.picture or user.avatar_url
        await db.commit()
        await db.refresh(user)
        return user, False

    user = User(
        name=profile.name.strip()[:80] or "Learner",
        email=profile.email,
        google_sub=profile.sub,
        avatar_url=profile.picture,
        level="A2",
        goals=[],
        comfort="awkward",
        tutor_name=get_settings().default_tutor_name,
        onboarded=False,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user, True
