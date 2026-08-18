from collections import Counter, defaultdict

from fastapi import HTTPException, status
from prisma.errors import UniqueViolationError
from prisma.models import Book

from app.modules.books import repository
from app.modules.books.schemas import BookCreate, BookListResponse, BookOut, BookSort, BookUpdate

# Category match counts less than an author match — a reader who's borrowed several
# Agatha Christie mysteries is more likely chasing "more Christie" than "more mystery".
_RECOMMENDATION_CATEGORY_WEIGHT = 2
_RECOMMENDATION_AUTHOR_WEIGHT = 3


async def _ratings_by_book(book_ids: list[str]) -> dict[str, tuple[float, int]]:
    reviews = await repository.list_ratings_for_books(book_ids)
    ratings: dict[str, list[int]] = defaultdict(list)
    for review in reviews:
        ratings[review.bookId].append(review.rating)
    return {
        book_id: (round(sum(values) / len(values), 1), len(values))
        for book_id, values in ratings.items()
    }


def _book_out(book: Book, ratings: dict[str, tuple[float, int]]) -> BookOut:
    average_rating, review_count = ratings.get(book.id, (None, 0))
    return BookOut.from_prisma(book, average_rating=average_rating, review_count=review_count)


async def _recommend(member_id: str, candidates: list[Book]) -> tuple[list[Book], dict[str, int]]:
    """Ranks candidates the member hasn't already borrowed by how closely they match
    the categories/authors of books the member *has* borrowed. Returns the filtered
    candidate list (already-borrowed books dropped) alongside each book's score."""
    loans = await repository.list_loans_for_member(member_id)
    borrowed_ids = {loan.bookId for loan in loans}
    categories = Counter(loan.book.category for loan in loans)
    authors = Counter(loan.book.author for loan in loans)

    unread = [book for book in candidates if book.id not in borrowed_ids]
    scores = {
        book.id: (
            categories.get(book.category, 0) * _RECOMMENDATION_CATEGORY_WEIGHT
            + authors.get(book.author, 0) * _RECOMMENDATION_AUTHOR_WEIGHT
        )
        for book in unread
    }
    return unread, scores


async def list_books(
    *,
    search: str | None,
    category: str | None,
    page: int,
    page_size: int,
    sort: BookSort = "newest",
    member_id: str | None = None,
) -> BookListResponse:
    if sort == "newest":
        items, total = await repository.list_books(
            search=search, category=category, page=page, page_size=page_size
        )
        ratings = await _ratings_by_book([item.id for item in items])
        return BookListResponse(
            items=[_book_out(item, ratings) for item in items],
            total=total,
            page=page,
            page_size=page_size,
        )

    if sort == "rating":
        # Ranked and paginated in SQL — only the page's reviews are then loaded for
        # display, instead of the whole catalogue and every review it has.
        items, total = await repository.list_books_by_rating(
            search=search, category=category, skip=(page - 1) * page_size, take=page_size
        )
        ratings = await _ratings_by_book([item.id for item in items])
        return BookListResponse(
            items=[_book_out(item, ratings) for item in items],
            total=total,
            page=page,
            page_size=page_size,
        )

    # "recommended" scores every candidate against this member's borrowing history,
    # so it genuinely needs the whole matching set before it can pick a page.
    all_books = await repository.find_all_matching(search, category)
    ratings = await _ratings_by_book([book.id for book in all_books])

    if sort == "recommended":
        scores: dict[str, int] = {}
        if member_id:
            all_books, scores = await _recommend(member_id, all_books)
        all_books.sort(
            key=lambda b: (scores.get(b.id, 0), ratings.get(b.id, (0.0, 0))[0]), reverse=True
        )

    total = len(all_books)
    start = (page - 1) * page_size
    page_items = all_books[start : start + page_size]
    return BookListResponse(
        items=[_book_out(book, ratings) for book in page_items],
        total=total,
        page=page,
        page_size=page_size,
    )


async def get_book(book_id: str) -> BookOut:
    book = await repository.find_by_id(book_id)
    if book is None or book.deletedAt is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")
    ratings = await _ratings_by_book([book_id])
    return _book_out(book, ratings)


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

    ratings = await _ratings_by_book([b.id for b in related])
    return [_book_out(b, ratings) for b in related]


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
        updated, error = await repository.update_book_with_inventory_guard(book_id, data)
        if error == "not_found":
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Book not found")
        if error == "active_loans":
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                "Total copies cannot be lower than the number of active loans",
            )
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
