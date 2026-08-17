from fastapi import HTTPException, status
from prisma.errors import UniqueViolationError

from app.modules.books import repository
from app.modules.books.schemas import BookCreate, BookListResponse, BookOut, BookUpdate


async def list_books(
    *, search: str | None, category: str | None, page: int, page_size: int
) -> BookListResponse:
    items, total = await repository.list_books(
        search=search, category=category, page=page, page_size=page_size
    )
    return BookListResponse(
        items=[BookOut.from_prisma(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
    )


async def get_book(book_id: str) -> BookOut:
    book = await repository.find_by_id(book_id)
    if book is None or book.deletedAt is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")
    return BookOut.from_prisma(book)


RELATED_BOOKS_LIMIT = 6


async def get_related_books(book_id: str) -> list[BookOut]:
    book = await repository.find_by_id(book_id)
    if book is None or book.deletedAt is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")

    related = await repository.find_co_borrowed(book_id, limit=RELATED_BOOKS_LIMIT)

    if len(related) < RELATED_BOOKS_LIMIT:
        exclude_ids = [book_id] + [b.id for b in related]
        related += await repository.find_by_category_or_author(
            category=book.category,
            author=book.author,
            exclude_ids=exclude_ids,
            limit=RELATED_BOOKS_LIMIT - len(related),
        )

    return [BookOut.from_prisma(b) for b in related]


async def create_book(payload: BookCreate) -> BookOut:
    try:
        book = await repository.create_book(
            {
                "title": payload.title,
                "author": payload.author,
                "category": payload.category,
                "isbn": payload.isbn,
                "description": payload.description,
                "publishedYear": payload.published_year,
                "language": payload.language,
                "coverImageUrl": payload.cover_image_url,
                "totalCopies": payload.total_copies,
            }
        )
    except UniqueViolationError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A book with this ISBN already exists",
        ) from exc

    return BookOut.from_prisma(book)


async def update_book(book_id: str, payload: BookUpdate) -> BookOut:
    existing = await repository.find_by_id(book_id)
    if existing is None or existing.deletedAt is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")

    fields_set = payload.model_fields_set
    data: dict = {}
    if payload.title is not None:
        data["title"] = payload.title
    if payload.author is not None:
        data["author"] = payload.author
    if payload.category is not None:
        data["category"] = payload.category
    if "isbn" in fields_set:
        data["isbn"] = payload.isbn
    if "description" in fields_set:
        data["description"] = payload.description
    if "published_year" in fields_set:
        data["publishedYear"] = payload.published_year
    if "language" in fields_set:
        data["language"] = payload.language
    if "cover_image_url" in fields_set:
        data["coverImageUrl"] = payload.cover_image_url
    if payload.total_copies is not None:
        data["totalCopies"] = payload.total_copies

    if not data:
        return BookOut.from_prisma(existing)

    try:
        updated = await repository.update_book(book_id, data)
    except UniqueViolationError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A book with this ISBN already exists",
        ) from exc

    return BookOut.from_prisma(updated)


async def delete_book(book_id: str) -> None:
    existing = await repository.find_by_id(book_id)
    if existing is None or existing.deletedAt is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")

    await repository.soft_delete_book(book_id)
