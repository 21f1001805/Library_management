from datetime import datetime

from prisma.models import Loan

from app.db.prisma import prisma

INCLUDE = {"book": True, "member": True}


async def create(*, book_id: str, member_id: str, due_date: datetime, created_by_id: str) -> Loan:
    return await prisma.loan.create(
        data={
            "bookId": book_id,
            "memberId": member_id,
            "dueDate": due_date,
            "createdById": created_by_id,
        },
        include=INCLUDE,
    )


async def find_by_id(loan_id: str) -> Loan | None:
    return await prisma.loan.find_unique(where={"id": loan_id}, include=INCLUDE)


async def list_all() -> list[Loan]:
    return await prisma.loan.find_many(include=INCLUDE, order={"dueDate": "asc"})


async def list_active() -> list[Loan]:
    return await prisma.loan.find_many(
        where={"returnedAt": None}, include=INCLUDE, order={"dueDate": "asc"}
    )


async def list_for_member(member_id: str) -> list[Loan]:
    return await prisma.loan.find_many(
        where={"memberId": member_id}, include=INCLUDE, order={"borrowedAt": "desc"}
    )


async def count_active_for_book(book_id: str) -> int:
    return await prisma.loan.count(where={"bookId": book_id, "returnedAt": None})


async def list_active_for_book(book_id: str) -> list[Loan]:
    return await prisma.loan.find_many(
        where={"bookId": book_id, "returnedAt": None},
        order={"dueDate": "asc"},
    )


async def mark_returned(loan_id: str, *, returned_at: datetime) -> Loan:
    return await prisma.loan.update(
        where={"id": loan_id}, data={"returnedAt": returned_at}, include=INCLUDE
    )


async def mark_fine_paid(loan_id: str) -> Loan:
    return await prisma.loan.update(
        where={"id": loan_id}, data={"finePaid": True}, include=INCLUDE
    )
