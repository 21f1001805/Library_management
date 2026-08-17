from datetime import date as date_type
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.modules.seat_booking.constants import SEAT_LABELS

DurationDays = Literal[3, 5, 7, 10]


class ManagerDashboardStatsOut(BaseModel):
    seats_booked_today: int
    books_issued_today: int
    new_registrations_today: int
    pending_tasks: int


class ManagerSeatBookingCreate(BaseModel):
    member_id: str
    seat_label: str
    date: date_type
    hour: int = Field(ge=0, le=23)

    @field_validator("seat_label")
    @classmethod
    def _validate_seat_label(cls, value: str) -> str:
        if value not in SEAT_LABELS:
            raise ValueError(f"Unknown seat: {value}")
        return value


class ManagerLoanCreate(BaseModel):
    member_id: str
    book_id: str
    duration_days: DurationDays


class ManagerReservationDecision(BaseModel):
    duration_days: DurationDays


class ManagerGuardianLinkCreate(BaseModel):
    student_email: EmailStr
    guardian_email: EmailStr


class PendingReservationOut(BaseModel):
    id: str
    book_id: str
    book_title: str
    member_id: str
    member_name: str
    member_email: str
    requested_at: datetime

    @staticmethod
    def from_prisma(reservation) -> "PendingReservationOut":
        return PendingReservationOut(
            id=reservation.id,
            book_id=reservation.bookId,
            book_title=reservation.book.title,
            member_id=reservation.memberId,
            member_name=reservation.member.fullName,
            member_email=reservation.member.email,
            requested_at=reservation.createdAt,
        )


class ManagerBookAvailabilityOut(BaseModel):
    id: str
    title: str
    author: str
    category: str
    total_copies: int
    available_copies: int
    is_available: bool
    # Earliest due date among this book's active loans — only set when no copy is
    # free right now (i.e. the soonest a copy is expected to come back).
    expected_available_at: datetime | None


class ManagerBookListOut(BaseModel):
    items: list[ManagerBookAvailabilityOut]
    total: int
    page: int
    page_size: int
