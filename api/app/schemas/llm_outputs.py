"""Shapes the LLM must return. Lenient on purpose: missing lists become empty."""

from typing import Any

from pydantic import BaseModel, Field, field_validator


def _none_to_list(v: Any) -> Any:
    return [] if v is None else v


class SilentCorrection(BaseModel):
    you_said: str
    native: str
    why: str = ""
    grammar_tag: str = "vocabulary"
    severity: int = Field(default=2, ge=1, le=3)


class TutorTurn(BaseModel):
    reply_de: str
    difficulty_signal: int = Field(default=0, ge=-1, le=1)
    silent_corrections: list[SilentCorrection] = []
    new_vocab: list[str] = []

    _lists = field_validator("silent_corrections", "new_vocab", mode="before")(_none_to_list)


class HelpOut(BaseModel):
    german: str
    note: str = ""


class NewWord(BaseModel):
    word: str
    gloss_en: str = ""


class RecapOut(BaseModel):
    fluency_score: int = Field(ge=0, le=100)
    summary: str = ""
    positives: list[str] = []
    next_step: str = ""
    new_words: list[NewWord] = []

    _lists = field_validator("positives", "new_words", mode="before")(_none_to_list)
