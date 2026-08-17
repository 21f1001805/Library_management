from datetime import UTC, datetime

from prisma.models import Book

from app.db.pagination import paginate
from app.db.prisma import prisma


async def find_by_id(book_id: str) -> Book | None:
    return await prisma.book.find_unique(where={"id": book_id})


async def find_by_isbn(isbn: str) -> Book | None:
    return await prisma.book.find_unique(where={"isbn": isbn})


async def list_books(
    *, search: str | None, category: str | None, page: int, page_size: int
) -> tuple[list[Book], int]:
    where: dict = {"deletedAt": None}
    if search:
        where["OR"] = [
            {"title": {"contains": search, "mode": "insensitive"}},
            {"author": {"contains": search, "mode": "insensitive"}},
            {"description": {"contains": search, "mode": "insensitive"}},
        ]
    if category and category.lower() != "all":
        where["category"] = category

    return await paginate(
        prisma.book,
        where=where,
        order={"createdAt": "desc"},
        skip=(page - 1) * page_size,
        take=page_size,
    )


async def find_co_borrowed(book_id: str, *, limit: int) -> list[Book]:
    borrower_loans = await prisma.loan.find_many(where={"bookId": book_id})
    member_ids = {loan.memberId for loan in borrower_loans}
    if not member_ids:
        return []

    other_loans = await prisma.loan.find_many(
        where={"memberId": {"in": list(member_ids)}, "bookId": {"not": book_id}},
        include={"book": True},
    )

    counts: dict[str, int] = {}
    books: dict[str, Book] = {}
    for loan in other_loans:
        if loan.book.deletedAt is not None:
            continue
        counts[loan.bookId] = counts.get(loan.bookId, 0) + 1
        books[loan.bookId] = loan.book

    ranked = sorted(books.values(), key=lambda b: counts[b.id], reverse=True)
    return ranked[:limit]


async def find_by_category_or_author(
    *, category: str, author: str, exclude_ids: list[str], limit: int
) -> list[Book]:
    return await prisma.book.find_many(
        where={
            "id": {"notIn": exclude_ids},
            "deletedAt": None,
            "OR": [{"category": category}, {"author": author}],
        },
        order={"createdAt": "desc"},
        take=limit,
    )


async def create_book(data: dict) -> Book:
    return await prisma.book.create(data=data)


async def update_book(book_id: str, data: dict) -> Book:
    return await prisma.book.update(where={"id": book_id}, data=data)


async def soft_delete_book(book_id: str) -> Book:
    return await prisma.book.update(where={"id": book_id}, data={"deletedAt": datetime.now(UTC)})
