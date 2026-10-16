"""SQLAlchemy models (CLAUDE.md §6.1).

No ORM relationships on purpose: with the async engine every traversal is an
explicit query, and deletes cascade at the database level.
"""

import uuid
from datetime import datetime
from typing import Any

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.config import get_settings
from app.db.base import Base

EMBEDDING_DIM = get_settings().embedding_dim


class IdMixin:
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)


class CreatedMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class User(IdMixin, CreatedMixin, Base):
    __tablename__ = "users"
    __table_args__ = (
        UniqueConstraint("email", name="uq_users_email"),
        UniqueConstraint("google_sub", name="uq_users_google_sub"),
    )

    name: Mapped[str] = mapped_column(String(80))
    email: Mapped[str | None] = mapped_column(String(254))
    password_hash: Mapped[str | None] = mapped_column(String(255))
    google_sub: Mapped[str | None] = mapped_column(String(64))
    avatar_url: Mapped[str | None] = mapped_column(String(500))
    onboarded: Mapped[bool] = mapped_column(Boolean, default=False, server_default=text("false"))
    level: Mapped[str] = mapped_column(String(2), default="B1")
    goals: Mapped[list[str]] = mapped_column(ARRAY(String(40)), default=list)
    comfort: Mapped[str] = mapped_column(String(20), default="awkward")
    tutor_name: Mapped[str] = mapped_column(String(40), default="Lena")
    correction_intensity: Mapped[str] = mapped_column(String(10), default="normal")


class TalkSession(IdMixin, Base):
    __tablename__ = "sessions"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    scenario: Mapped[str | None] = mapped_column(String(40))
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    minutes: Mapped[float | None] = mapped_column(Float)
    fluency_score: Mapped[int | None] = mapped_column(Integer)
    summary: Mapped[str | None] = mapped_column(Text)
    # CEFR index the tutor currently pitches at: 0=A1 … 5=C2. Nudged by difficulty_signal.
    difficulty: Mapped[int] = mapped_column(Integer, default=2)
    recap: Mapped[dict[str, Any] | None] = mapped_column(JSONB)


class Message(IdMixin, CreatedMixin, Base):
    __tablename__ = "messages"

    session_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("sessions.id", ondelete="CASCADE"), index=True
    )
    seq: Mapped[int] = mapped_column(Integer)
    role: Mapped[str] = mapped_column(String(8))  # user | tutor
    text_de: Mapped[str] = mapped_column(Text)
    text_en_hint: Mapped[str | None] = mapped_column(Text)
    audio_url: Mapped[str | None] = mapped_column(String(300))
    # True when the line came from "Help me say this"; excluded from fluency scoring.
    assisted: Mapped[bool] = mapped_column(Boolean, default=False)


class Correction(IdMixin, CreatedMixin, Base):
    __tablename__ = "corrections"

    session_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("sessions.id", ondelete="CASCADE"), index=True
    )
    message_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("messages.id", ondelete="SET NULL")
    )
    you_said: Mapped[str] = mapped_column(Text)
    native: Mapped[str] = mapped_column(Text)
    why: Mapped[str] = mapped_column(Text)
    grammar_tag: Mapped[str] = mapped_column(String(40), index=True)
    severity: Mapped[int] = mapped_column(Integer, default=2)  # 1 minor … 3 blocks understanding


class Vocab(IdMixin, CreatedMixin, Base):
    __tablename__ = "vocab"
    __table_args__ = (UniqueConstraint("user_id", "word", name="uq_vocab_user_word"),)

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    word: Mapped[str] = mapped_column(String(80))
    lemma: Mapped[str | None] = mapped_column(String(80))
    gloss_en: Mapped[str | None] = mapped_column(String(200))
    first_seen_session: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("sessions.id", ondelete="SET NULL")
    )
    times_used: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(10), default="new")  # new | learning | owned


class Memory(IdMixin, CreatedMixin, Base):
    __tablename__ = "memories"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    kind: Mapped[str] = mapped_column(
        String(20), index=True
    )  # fact|mistake_pattern|preference|goal
    text: Mapped[str] = mapped_column(Text)
    embedding: Mapped[list[float] | None] = mapped_column(Vector(EMBEDDING_DIM))
    weight: Mapped[float] = mapped_column(Float, default=1.0)
    last_used: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ReferenceChunk(IdMixin, CreatedMixin, Base):
    __tablename__ = "reference_chunks"

    source: Mapped[str] = mapped_column(String(20), index=True)  # grammar|scenario|phrasebook
    title: Mapped[str] = mapped_column(String(200))
    text: Mapped[str] = mapped_column(Text)
    level: Mapped[str] = mapped_column(String(2), index=True)
    embedding: Mapped[list[float] | None] = mapped_column(Vector(EMBEDDING_DIM))
    meta: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    content_hash: Mapped[str] = mapped_column(String(64), unique=True)


class LLMCall(IdMixin, CreatedMixin, Base):
    """One row per provider attempt, so quota behaviour is visible without guessing."""

    __tablename__ = "llm_calls"

    purpose: Mapped[str] = mapped_column(String(30), index=True)
    provider: Mapped[str] = mapped_column(String(20))
    model: Mapped[str] = mapped_column(String(60))
    prompt_tokens: Mapped[int | None] = mapped_column(Integer)
    completion_tokens: Mapped[int | None] = mapped_column(Integer)
    latency_ms: Mapped[int] = mapped_column(Integer)
    ok: Mapped[bool] = mapped_column(Boolean)
    error: Mapped[str | None] = mapped_column(String(300))
    session_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("sessions.id", ondelete="SET NULL")
    )


class AuthToken(IdMixin, CreatedMixin, Base):
    """Opaque bearer tokens, stored hashed. One row per login or device."""

    __tablename__ = "auth_tokens"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    user_agent: Mapped[str | None] = mapped_column(String(200))
