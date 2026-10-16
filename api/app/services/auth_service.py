"""Email + password accounts with opaque, revocable bearer tokens. Self-hosted, $0.

Passwords are hashed with argon2id. Tokens are 32 random bytes handed to the
client once and stored only as a SHA-256 hash, one row per login or device.
"""

import asyncio
import hashlib
import secrets
from datetime import UTC, datetime, timedelta

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db.models import AuthToken, User

_hasher = PasswordHasher()
# Verified when the email is unknown, so a failed login takes the same time either way.
_DUMMY_HASH = _hasher.hash("not-a-real-password")
TOUCH_INTERVAL = timedelta(minutes=5)


class EmailTaken(Exception):
    pass


def normalize_email(email: str) -> str:
    return email.strip().lower()


async def hash_password(password: str) -> str:
    return await asyncio.to_thread(_hasher.hash, password)


async def verify_password(password_hash: str | None, password: str) -> bool:
    try:
        return await asyncio.to_thread(_hasher.verify, password_hash or _DUMMY_HASH, password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def _token_hash(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


async def register(db: AsyncSession, email: str, password: str, name: str | None = None) -> User:
    email = normalize_email(email)
    if await db.scalar(select(User.id).where(User.email == email)) is not None:
        raise EmailTaken(email)
    display = (name or email.split("@", 1)[0]).strip()[:80] or "Learner"
    user = User(
        name=display,
        email=email,
        password_hash=await hash_password(password),
        level="A2",
        goals=[],
        comfort="awkward",
        tutor_name=get_settings().default_tutor_name,
        onboarded=False,
    )
    db.add(user)
    try:
        await db.commit()
    except IntegrityError as err:  # two registrations raced on the same email
        await db.rollback()
        raise EmailTaken(email) from err
    await db.refresh(user)
    return user


async def authenticate(db: AsyncSession, email: str, password: str) -> User | None:
    user = (
        await db.execute(select(User).where(User.email == normalize_email(email)))
    ).scalar_one_or_none()
    ok = await verify_password(user.password_hash if user else None, password)
    return user if (user is not None and ok) else None


async def issue_token(db: AsyncSession, user: User, user_agent: str | None = None) -> str:
    raw = secrets.token_urlsafe(32)
    db.add(
        AuthToken(
            user_id=user.id,
            token_hash=_token_hash(raw),
            expires_at=datetime.now(UTC) + timedelta(days=get_settings().auth_token_days),
            user_agent=(user_agent or "")[:200] or None,
        )
    )
    await db.commit()
    return raw


async def resolve_token(db: AsyncSession, raw: str) -> User | None:
    row = (
        await db.execute(select(AuthToken).where(AuthToken.token_hash == _token_hash(raw)))
    ).scalar_one_or_none()
    now = datetime.now(UTC)
    if row is None or row.expires_at <= now:
        return None
    user = await db.get(User, row.user_id)
    if user is None:
        return None
    if row.last_used_at is None or now - row.last_used_at > TOUCH_INTERVAL:
        row.last_used_at = now
        await db.commit()
    return user


async def revoke_token(db: AsyncSession, raw: str) -> None:
    await db.execute(delete(AuthToken).where(AuthToken.token_hash == _token_hash(raw)))
    await db.commit()
