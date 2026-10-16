import uuid
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.engine import get_session
from app.db.models import TalkSession, User
from app.services import auth_service

DB = Annotated[AsyncSession, Depends(get_session)]

_bearer = HTTPBearer(auto_error=False)
Credentials = Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)]


def _unauthorized() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Please sign in.",
        headers={"WWW-Authenticate": "Bearer"},
    )


async def get_current_user(db: DB, creds: Credentials) -> User:
    """Resolve the bearer token to its user, or 401."""
    if creds is None:
        raise _unauthorized()
    user = await auth_service.resolve_token(db, creds.credentials)
    if user is None:
        raise _unauthorized()
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


async def load_session(db: AsyncSession, user: User, session_id: uuid.UUID) -> TalkSession:
    session = await db.get(TalkSession, session_id)
    if session is None or session.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    return session
