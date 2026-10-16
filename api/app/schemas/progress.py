import uuid
from datetime import date, datetime

from pydantic import BaseModel


class DayCell(BaseModel):
    date: date
    minutes: float
    sessions: int


class TagTrend(BaseModel):
    grammar_tag: str
    total: int
    weekly: list[int]  # aligned with ProgressResponse.weeks


class VocabPoint(BaseModel):
    week_start: date
    owned: int


class SessionRow(BaseModel):
    session_id: uuid.UUID
    scenario: str
    scenario_title: str
    ended_at: datetime
    minutes: float
    notes: int
    fluency_score: int | None


class Totals(BaseModel):
    sessions: int
    minutes: float
    words: int
    corrections: int


class ProgressResponse(BaseModel):
    days: list[DayCell]  # last 35 days, oldest first, today last
    streak_days: int
    best_streak: int
    weeks: list[date]  # Monday of each of the last 4 weeks, oldest first
    weak_spots: list[TagTrend]  # top tags of those 4 weeks, by total
    vocab: list[VocabPoint]  # cumulative words owned at the end of each of the last 8 weeks
    sessions: list[SessionRow]  # most recent finished sessions, newest first
    totals: Totals
