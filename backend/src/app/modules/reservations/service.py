from datetime import UTC, datetime

from fastapi import HTTPException, status

from app.core.constants import Role
from app.db.prisma import prisma
from app.modules.loans import repository as loans_repository
from app.modules.notifications import service as notifications_service
from app.modules.reservations import repository
from app.modules.reservations.schemas import ReservationCreate, ReservationOut


async def _notify_managers(message: str) -> None:
    managers = await prisma.user.find_many(where={"role": {"name": Role.MANAGER}, "deletedAt": None})
    for manager in managers:
        await notifications_service.create_notification(manager.id, "reservation-requested", message)


async def _queue_info(reservation) -> tuple[int | None, int | None]:
    if reservation.status != "pending":
        return None, None

    pending = await repository.list_pending_for_book(reservation.bookId)
    position = next((i + 1 for i, r in enumerate(pending) if r.id == reservation.id), None)
    if position is None:
        return None, None

    available_now = await repository.count_available_copies(reservation.bookId)
    if position <= available_now:
        return position, 0

    # Copies still on loan, ordered by return date — the (position - available_now)-th
    # one to come back is what finally frees up a copy for this member's turn.
    loans_ahead = await loans_repository.list_active_for_book(reservation.bookId)
    needed = position - available_now
    if needed > len(loans_ahead):
        return position, None

    eta_date = loans_ahead[needed - 1].dueDate
    eta_days = max(0, (eta_date.date() - datetime.now(UTC).date()).days)
    return position, eta_days


async def list_my_reservations(member_id: str) -> list[ReservationOut]:
    reservations = await repository.list_active_for_member(member_id)
    out = []
    for r in reservations:
        position, eta_days = await _queue_info(r)
        out.append(ReservationOut.from_prisma(r, queue_position=position, eta_days=eta_days))
    return out


async def create_reservation(member_id: str, payload: ReservationCreate) -> ReservationOut:
    try:
        reservation = await repository.create_reservation(
            member_id=member_id, book_id=payload.book_id
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Book is not available"
        ) from exc

    await notifications_service.create_notification(
        member_id,
        "reservation-requested",
        f'Your request to borrow "{reservation.book.title}" is awaiting manager approval.',
    )
    await _notify_managers(
        f'{reservation.member.fullName} requested to borrow "{reservation.book.title}".'
    )
    position, eta_days = await _queue_info(reservation)
    return ReservationOut.from_prisma(reservation, queue_position=position, eta_days=eta_days)


async def cancel_reservation(member_id: str, reservation_id: str) -> None:
    reservation = await repository.find_by_id(reservation_id)
    if (
        reservation is None
        or reservation.memberId != member_id
        or reservation.status != "pending"
    ):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reservation not found")

    await repository.cancel_reservation(reservation_id)
