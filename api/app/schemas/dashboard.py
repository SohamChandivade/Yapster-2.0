import uuid
from datetime import datetime

from pydantic import BaseModel

from app.schemas.users import UserOut


class LastSession(BaseModel):
    session_id: uuid.UUID
    scenario: str
    scenario_title: str
    minutes: float
    notes: int
    fluency_score: int | None
    ended_at: datetime


class NextSession(BaseModel):
    scenario: str
    scenario_title: str
    minutes: int
    reason: str


class WeakSpot(BaseModel):
    grammar_tag: str
    count: int
    example_native: str | None


class OpenSession(BaseModel):
    """A conversation that was started but never finished, offered for resuming."""

    session_id: uuid.UUID
    scenario: str
    scenario_title: str
    started_at: datetime
    turns: int


class DashboardResponse(BaseModel):
    user: UserOut
    day: int
    streak_days: int
    minutes_last_7_days: float
    weekly_goal_minutes: int
    sessions_total: int
    words_owned: int
    words_last_7_days: int
    last_session: LastSession | None
    next_session: NextSession
    weak_spot: WeakSpot | None
    open_session: OpenSession | None
