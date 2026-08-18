import re
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

BookSort = Literal["newest", "rating", "recommended"]

_ISBN_CHARS = re.compile(r"[- ]")
_ISBN_10 = re.compile(r"^\d{9}[\dX]$")
_ISBN_13 = re.compile(r"^\d{13}$")
_EARLIEST_PRINT_YEAR = 1450
_MAX_PUBLISHED_YEAR = date.today().year + 1


def _validate_isbn(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = _ISBN_CHARS.sub("", value).upper()
    if not (_ISBN_10.match(normalized) or _ISBN_13.match(normalized)):
        raise ValueError("isbn must be a 10 or 13 digit ISBN (hyphens/spaces allowed)")
    return normalized


class BookCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    author: str = Field(min_length=1, max_length=150)
    category: str = Field(min_length=1, max_length=80)
    isbn: str | None = Field(default=None, max_length=20)
    description: str | None = None
    published_year: int | None = Field(
        default=None, ge=_EARLIEST_PRINT_YEAR, le=_MAX_PUBLISHED_YEAR
    )
    language: str | None = Field(default=None, max_length=40)
    cover_image_url: str | None = Field(default=None, max_length=2048)
    total_copies: int = Field(default=0, ge=0)

    _validate_isbn = field_validator("isbn")(_validate_isbn)


class BookUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    author: str | None = Field(default=None, min_length=1, max_length=150)
    category: str | None = Field(default=None, min_length=1, max_length=80)
    isbn: str | None = Field(default=None, max_length=20)
    description: str | None = None
    published_year: int | None = Field(
        default=None, ge=_EARLIEST_PRINT_YEAR, le=_MAX_PUBLISHED_YEAR
    )
    language: str | None = Field(default=None, max_length=40)
    cover_image_url: str | None = Field(default=None, max_length=2048)
    total_copies: int | None = Field(default=None, ge=0)

    _validate_isbn = field_validator("isbn")(_validate_isbn)


class BookOut(BaseModel):
    id: str
    title: str
    author: str
    category: str
    isbn: str | None
    description: str | None
    published_year: int | None
    language: str | None
    cover_image_url: str | None
    total_copies: int
    available: bool
    average_rating: float | None
    review_count: int
    created_at: datetime
    updated_at: datetime

    @staticmethod
    def from_prisma(
        book, *, average_rating: float | None = None, review_count: int = 0
    ) -> "BookOut":
        return BookOut(
            id=book.id,
            title=book.title,
            author=book.author,
            category=book.category,
            isbn=book.isbn,
            description=book.description,
            published_year=book.publishedYear,
            language=book.language,
            cover_image_url=book.coverImageUrl,
            total_copies=book.totalCopies,
            available=book.totalCopies > 0,
            average_rating=average_rating,
            review_count=review_count,
            created_at=book.createdAt,
            updated_at=book.updatedAt,
        )


class BookListResponse(BaseModel):
    items: list[BookOut]
    total: int
    page: int
    page_size: int
