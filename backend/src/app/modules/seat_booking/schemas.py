from datetime import date as date_type
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.modules.seat_booking.constants import SEAT_LABELS


class SeatBookingCreate(BaseModel):
    seat_label: str
    date: date_type
    hour: int = Field(ge=0, le=23)

    @field_validator("seat_label")
    @classmethod
    def _validate_seat_label(cls, value: str) -> str:
        if value not in SEAT_LABELS:
            raise ValueError(f"Unknown seat: {value}")
        return value


class SeatNotifyCreate(BaseModel):
    seat_label: str
    date: date_type
    hour: int = Field(ge=0, le=23)

    @field_validator("seat_label")
    @classmethod
    def _validate_seat_label(cls, value: str) -> str:
        if value not in SEAT_LABELS:
            raise ValueError(f"Unknown seat: {value}")
        return value


class SeatSlotOut(BaseModel):
    seat_label: str
    status: str  # available | reserved | booked_by_me
    booking_id: str | None = None
    # Set for both "reserved" and "booked_by_me" — lets the seat grid show who has it
    # (someone else, or the current member themself) rather than a plain color swatch.
    # Deliberately just the avatar, not the member's name: the seat grid is visible to
    # every member, so this stays a lightweight visual cue rather than exposing another
    # member's identity outright.
    booked_by_avatar_url: str | None = None


class ScheduleOut(BaseModel):
    date: date_type
    hour: int
    seats: list[SeatSlotOut]


class SeatAvailabilitySummary(BaseModel):
    available: int
    booked: int
    total: int


class SeatBookingOut(BaseModel):
    id: str
    seat_label: str
    date: date_type
    hour: int
    created_at: datetime

    @staticmethod
    def from_prisma(booking) -> "SeatBookingOut":
        return SeatBookingOut(
            id=booking.id,
            seat_label=booking.seatLabel,
            date=booking.date.date(),
            hour=booking.hour,
            created_at=booking.createdAt,
        )
