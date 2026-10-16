import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class StartSessionRequest(BaseModel):
    scenario: str | None = None


class StartSessionResponse(BaseModel):
    session_id: uuid.UUID
    scenario: str
    scenario_title: str
    tutor_name: str
    opening: str
    level: str
    difficulty: int


class TurnRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    assisted: bool = False


class TurnDone(BaseModel):
    message_id: uuid.UUID
    reply_de: str
    correction_count: int
    new_corrections: int
    difficulty: int
    level: str
    new_vocab: list[str]
    provider: str
    model: str


class HelpRequest(BaseModel):
    english: str = Field(min_length=1, max_length=500)


class HelpResponse(BaseModel):
    german: str
    note: str


class DifficultyRequest(BaseModel):
    delta: int = Field(ge=-1, le=1)


class DifficultyResponse(BaseModel):
    difficulty: int
    level: str


class CorrectionItem(BaseModel):
    id: uuid.UUID
    you_said: str
    native: str
    why: str
    grammar_tag: str
    severity: int


class TranscriptLine(BaseModel):
    id: uuid.UUID
    role: str
    text: str
    assisted: bool


class SessionState(BaseModel):
    session_id: uuid.UUID
    scenario: str
    scenario_title: str
    tutor_name: str
    level: str
    difficulty: int
    started_at: datetime
    ended: bool
    correction_count: int
    transcript: list[TranscriptLine]


class NoteOut(BaseModel):
    you_said: str
    native_would_say: str
    why: str
    grammar_tag: str
    times: int = 1


class WordOut(BaseModel):
    word: str
    gloss_en: str = ""


class RecapResponse(BaseModel):
    session_id: uuid.UUID
    scenario: str
    scenario_title: str
    tutor_name: str
    minutes: float
    words_produced: int
    fluency_score: int | None
    summary: str | None
    notes: list[NoteOut]
    positives: list[str]
    next_step: str | None
    new_words: list[WordOut]
