from prisma.models import Reservation

from app.db.prisma import prisma
from app.modules.books import repository as books_repository
from app.modules.loans import repository as loans_repository

RESERVATION_INCLUDE = {"book": True, "loan": True}


async def find_by_id(reservation_id: str) -> Reservation | None:
    return await prisma.reservation.find_unique(
        where={"id": reservation_id}, include=RESERVATION_INCLUDE
    )


async def list_active_for_member(member_id: str) -> list[Reservation]:
    return await prisma.reservation.find_many(
        where={"memberId": member_id, "status": {"in": ["pending", "approved"]}},
        include=RESERVATION_INCLUDE,
        order={"createdAt": "desc"},
    )


async def list_pending() -> list[Reservation]:
    return await prisma.reservation.find_many(
        where={"status": "pending"},
        include={"book": True, "member": True},
        order={"createdAt": "asc"},
    )


async def list_pending_for_book(book_id: str) -> list[Reservation]:
    return await prisma.reservation.find_many(
        where={"bookId": book_id, "status": "pending"},
        order={"createdAt": "asc"},
    )


async def count_available_copies(book_id: str) -> int:
    book = await books_repository.find_by_id(book_id)
    if book is None:
        return 0
    on_loan = await loans_repository.count_active_for_book(book_id)
    return max(0, book.totalCopies - on_loan)


async def create_reservation(*, member_id: str, book_id: str) -> Reservation:
    if await count_available_copies(book_id) <= 0:
        raise ValueError("Book is not available")

    return await prisma.reservation.create(
        data={"memberId": member_id, "bookId": book_id},
        include={**RESERVATION_INCLUDE, "member": True},
    )


async def cancel_reservation(reservation_id: str) -> Reservation:
    return await prisma.reservation.update(
        where={"id": reservation_id}, data={"status": "cancelled"}, include=RESERVATION_INCLUDE
    )


async def approve(reservation_id: str, *, loan_id: str) -> Reservation:
    return await prisma.reservation.update(
        where={"id": reservation_id},
        data={"status": "approved", "loanId": loan_id},
        include=RESERVATION_INCLUDE,
    )


async def reject(reservation_id: str) -> Reservation:
    return await prisma.reservation.update(
        where={"id": reservation_id}, data={"status": "rejected"}, include=RESERVATION_INCLUDE
    )
