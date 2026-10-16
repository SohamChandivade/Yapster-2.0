import uuid

from pydantic import BaseModel, Field


class ScenarioOut(BaseModel):
    slug: str
    title: str
    blurb: str
    minutes: int


class SaveVocabRequest(BaseModel):
    session_id: uuid.UUID | None = None
    words: list[str] = Field(min_length=1, max_length=50)


class SaveVocabResponse(BaseModel):
    saved: int
    total: int
