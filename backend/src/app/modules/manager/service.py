from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status
from prisma.models import User

from app.db.prisma import prisma
from app.modules.guardian import service as guardian_service
from app.modules.guardian.schemas import GuardianLinkCreate
from app.modules.loans import service as loans_service
from app.modules.loans.schemas import LoanCreate, LoanOut
from app.modules.manager import repository
from app.modules.manager.schemas import (
    ManagerBookAvailabilityOut,
    ManagerBookListOut,
    ManagerDashboardStatsOut,
    ManagerGuardianLinkCreate,
    ManagerLoanCreate,
    ManagerSeatBookingCreate,
    PendingReservationOut,
)
from app.modules.members import repository as members_repository
from app.modules.notifications import service as notifications_service
from app.modules.reservations import repository as reservations_repository
from app.modules.reservations.schemas import ReservationOut
from app.modules.seat_booking import service as seat_booking_service
from app.modules.seat_booking.schemas import SeatBookingCreate, SeatBookingOut


def _today_window() -> tuple[datetime, datetime]:
    now = datetime.now(UTC)
    start = datetime(now.year, now.month, now.day, tzinfo=UTC)
    return start, start + timedelta(days=1)


async def get_dashboard_stats() -> ManagerDashboardStatsOut:
    start, end = _today_window()

    seats_booked_today = await repository.count_seat_bookings_created_between(start, end)
    books_issued_today = await repository.count_loans_created_between(start, end)
    new_registrations_today = await repository.count_members_created_between(start, end)
    pending_billing_requests = await repository.count_pending_billing_requests()
    open_support_tickets = await repository.count_open_support_tickets()
    pending_reservations = await repository.count_pending_reservations()

    return ManagerDashboardStatsOut(
        seats_booked_today=seats_booked_today,
        books_issued_today=books_issued_today,
        new_registrations_today=new_registrations_today,
        pending_tasks=pending_billing_requests + open_support_tickets + pending_reservations,
    )


async def _find_member_or_404(member_id: str) -> User:
    member = await members_repository.find_by_id(member_id)
    if member is None or member.deletedAt is not None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Member not found")
    return member


async def book_seat_for_member(payload: ManagerSeatBookingCreate) -> SeatBookingOut:
    member = await _find_member_or_404(payload.member_id)
    return await seat_booking_service.book_seat(
        member,
        SeatBookingCreate(seat_label=payload.seat_label, date=payload.date, hour=payload.hour),
    )


async def issue_loan_for_member(manager_id: str, payload: ManagerLoanCreate) -> LoanOut:
    await _find_member_or_404(payload.member_id)
    return await loans_service.create_loan(
        manager_id,
        LoanCreate(book_id=payload.book_id, member_id=payload.member_id),
        duration_days=payload.duration_days,
    )


async def link_guardian(payload: ManagerGuardianLinkCreate) -> None:
    student = await members_repository.find_by_email(payload.student_email)
    guardian = await members_repository.find_by_email(payload.guardian_email)
    if student is None or guardian is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Guardian or member not found")

    await guardian_service.link_child(
        GuardianLinkCreate(guardian_id=guardian.id, member_id=student.id)
    )


async def list_pending_reservations() -> list[PendingReservationOut]:
    rows = await reservations_repository.list_pending()
    return [PendingReservationOut.from_prisma(row) for row in rows]


async def approve_reservation(
    manager_id: str, reservation_id: str, duration_days: int
) -> ReservationOut:
    async with prisma.tx() as tx:
        # Serialize decisions for the same reservation, then re-read its state inside
        # the transaction. The loan helper separately locks the book inventory.
        await tx.execute_raw("SELECT pg_advisory_xact_lock(hashtext($1))", reservation_id)
        reservation = await reservations_repository.find_by_id(reservation_id, client=tx)
        if reservation is None or reservation.status != "pending":
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Pending reservation not found")

        loan = await loans_service.create_loan(
            manager_id,
            LoanCreate(book_id=reservation.bookId, member_id=reservation.memberId),
            duration_days=duration_days,
            client=tx,
        )
        updated = await reservations_repository.approve(reservation_id, loan_id=loan.id, client=tx)

    await notifications_service.create_notification(
        reservation.memberId,
        "reservation-approved",
        f'Your request to borrow "{reservation.book.title}" was approved — '
        f"please pick it up and return it by {loan.due_date.strftime('%b %d, %Y')}.",
    )
    return ReservationOut.from_prisma(updated)


async def reject_reservation(reservation_id: str) -> ReservationOut:
    async with prisma.tx() as tx:
        # Same lock key and same re-read-inside-the-transaction as approve_reservation.
        # Both decisions must serialise against each other, or an approve that read
        # 'pending' before a rejection committed overwrites it and issues the book.
        await tx.execute_raw("SELECT pg_advisory_xact_lock(hashtext($1))", reservation_id)
        reservation = await reservations_repository.find_by_id(reservation_id, client=tx)
        if reservation is None or reservation.status != "pending":
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Pending reservation not found")
        updated = await reservations_repository.reject(reservation_id, client=tx)

    await notifications_service.create_notification(
        reservation.memberId,
        "reservation-rejected",
        f'Your request to borrow "{reservation.book.title}" was declined.',
    )
    return ReservationOut.from_prisma(updated)


async def list_book_availability(
    *, search: str | None, page: int, page_size: int
) -> ManagerBookListOut:
    books, total = await repository.list_books(search=search, page=page, page_size=page_size)
    active_loans = await repository.list_active_loans_for_books([book.id for book in books])

    loaned_out_count: dict[str, int] = {}
    earliest_due_at: dict[str, datetime] = {}
    for loan in active_loans:
        loaned_out_count[loan.bookId] = loaned_out_count.get(loan.bookId, 0) + 1
        # Loans arrive sorted by dueDate ascending, so the first one seen per book
        # is already the earliest.
        earliest_due_at.setdefault(loan.bookId, loan.dueDate)

    items = []
    for book in books:
        available_copies = max(0, book.totalCopies - loaned_out_count.get(book.id, 0))
        items.append(
            ManagerBookAvailabilityOut(
                id=book.id,
                title=book.title,
                author=book.author,
                category=book.category,
                total_copies=book.totalCopies,
                available_copies=available_copies,
                is_available=available_copies > 0,
                expected_available_at=(
                    None if available_copies > 0 else earliest_due_at.get(book.id)
                ),
            )
        )

    return ManagerBookListOut(items=items, total=total, page=page, page_size=page_size)
