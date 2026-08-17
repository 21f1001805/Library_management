from fastapi import HTTPException, status
from prisma.errors import ForeignKeyViolationError, UniqueViolationError

from app.core.constants import Role
from app.modules.reviews import repository
from app.modules.reviews.schemas import (
    BookReviewsOut,
    RatingBreakdownEntry,
    ReviewCreate,
    ReviewOut,
    ReviewUpdate,
)

MODERATOR_ROLES = {Role.ADMIN.value, Role.IT_HEAD.value}


async def get_book_reviews(book_id: str, *, viewer_id: str) -> BookReviewsOut:
    reviews = await repository.list_for_book(book_id)
    total = len(reviews)
    average = round(sum(review.rating for review in reviews) / total, 1) if total else 0.0
    return BookReviewsOut(
        items=[ReviewOut.from_prisma(review, current_user_id=viewer_id) for review in reviews],
        average_rating=average,
        total_reviews=total,
        breakdown=_build_breakdown(reviews),
    )


async def get_all_reviews(*, viewer_id: str) -> list[ReviewOut]:
    reviews = await repository.list_all()
    return [ReviewOut.from_prisma(review, current_user_id=viewer_id) for review in reviews]


async def create_review(book_id: str, member_id: str, payload: ReviewCreate) -> ReviewOut:
    try:
        review = await repository.create(
            book_id=book_id,
            member_id=member_id,
            rating=payload.rating,
            comment=payload.comment,
            images=payload.images,
        )
    except UniqueViolationError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You've already reviewed this book — edit your review instead",
        ) from exc
    except ForeignKeyViolationError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found") from exc

    return ReviewOut.from_prisma(review, current_user_id=member_id)


async def update_review(review_id: str, member_id: str, payload: ReviewUpdate) -> ReviewOut:
    existing = await repository.find_by_id(review_id)
    if existing is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found")
    if existing.memberId != member_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="You can only edit your own review"
        )

    updated = await repository.update(
        review_id, rating=payload.rating, comment=payload.comment, images=payload.images
    )
    return ReviewOut.from_prisma(updated, current_user_id=member_id)


async def delete_review(review_id: str, *, user_id: str, user_role: str) -> None:
    existing = await repository.find_by_id(review_id)
    if existing is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found")
    if existing.memberId != user_id and user_role not in MODERATOR_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="You can't delete this review"
        )

    await repository.delete(review_id)


def _build_breakdown(reviews: list) -> list[RatingBreakdownEntry]:
    total = len(reviews)
    counts = dict.fromkeys(range(1, 6), 0)
    for review in reviews:
        counts[review.rating] = counts.get(review.rating, 0) + 1

    return [
        RatingBreakdownEntry(
            stars=stars,
            percent=round((counts[stars] / total) * 100, 1) if total else 0.0,
        )
        for stars in range(5, 0, -1)
    ]
