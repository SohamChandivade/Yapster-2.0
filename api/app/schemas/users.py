import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.config import Level

Comfort = Literal["terrifying", "awkward", "fine", "pretty_good"]


class OnboardingRequest(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    level: Level = "A2"
    comfort: Comfort = "awkward"
    goals: list[str] = []
    tutor_name: str = Field(default="Lena", max_length=40)


class UserOut(BaseModel):
    id: uuid.UUID
    name: str
    email: str | None = None
    avatar_url: str | None = None
    onboarded: bool = False
    level: str
    comfort: str
    goals: list[str]
    tutor_name: str
    correction_intensity: str
    created_at: datetime


class Stats(BaseModel):
    sessions: int
    minutes: float
    words_owned: int
    corrections: int


class MeResponse(BaseModel):
    user: UserOut
    stats: Stats
