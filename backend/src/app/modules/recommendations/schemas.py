from typing import Literal

from pydantic import BaseModel

from app.modules.books.schemas import BookOut

QuestionId = Literal["author", "era", "story_type", "popularity"]

# Sent by every question as its last option. Answering with this (or omitting the
# question) is normalized to "no preference" server-side — see service._normalize_answers.
NO_PREFERENCE = "no_preference"


class QuizOption(BaseModel):
    id: str
    label: str


class QuizQuestion(BaseModel):
    id: QuestionId
    prompt: str
    options: list[QuizOption]


class QuizResponse(BaseModel):
    questions: list[QuizQuestion]


class QuizAnswers(BaseModel):
    """One selected option id per question, keyed by question id. Every non-null value
    is re-validated against a freshly recomputed set of currently-valid options before
    it's ever used — see service._normalize_answers. Nothing here is trusted as-is."""

    author: str | None = None
    era: str | None = None
    story_type: str | None = None
    popularity: str | None = None


class RecommendationItem(BaseModel):
    book: BookOut
    score: float
    reasons: list[str]


class RecommendationResponse(BaseModel):
    items: list[RecommendationItem]
    relaxed: bool
    message: str
