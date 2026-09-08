import { Prisma } from '@prisma/client';

import { HttpError } from '@/server/http';
import { Role } from '@/server/constants';
import * as booksRepository from '@/server/books/repository';
import * as repository from '@/server/reviews/repository';
import type { ReviewWithRelations } from '@/server/reviews/repository';
import {
  reviewToJson,
  type BookReviewsOut,
  type RatingBreakdownEntry,
  type ReviewCreateInput,
  type ReviewOut,
  type ReviewUpdateInput,
} from '@/server/reviews/schemas';

// Mirrors backend/src/app/modules/reviews/service.py. The LLM-generated review digest
// (_generate_digest) is phase 7 — this returns a cached digest if one already exists on
// the book row, but never calls an LLM to generate a fresh one yet.
const MODERATOR_ROLES = new Set<string>([Role.ADMIN, Role.IT_HEAD]);

function buildBreakdown(reviews: ReviewWithRelations[]): RatingBreakdownEntry[] {
  const total = reviews.length;
  const counts = new Map<number, number>([1, 2, 3, 4, 5].map((n) => [n, 0]));
  for (const review of reviews) {
    counts.set(review.rating, (counts.get(review.rating) ?? 0) + 1);
  }
  return [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    percent: total ? Math.round(((counts.get(stars) ?? 0) / total) * 1000) / 10 : 0,
  }));
}

async function cachedReviewDigest(bookId: string, total: number): Promise<string | null> {
  if (total === 0) return null;
  const book = await booksRepository.findById(bookId);
  if (!book) return null;
  // A cache hit is "the digest already covers exactly this many reviews" — any change to
  // the review count (new review, delete) invalidates it. Generating a fresh one is
  // phase 7 (LLM-backed); until then a stale/missing digest just stays null.
  if (book.reviewDigest !== null && book.reviewDigestReviewCount === total) {
    return book.reviewDigest;
  }
  return null;
}

export async function getBookReviews(bookId: string, viewerId: string): Promise<BookReviewsOut> {
  const reviews = await repository.listForBook(bookId);
  const total = reviews.length;
  const average = total
    ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / total) * 10) / 10
    : 0;
  return {
    items: reviews.map((review) => reviewToJson(review, viewerId)),
    average_rating: average,
    total_reviews: total,
    breakdown: buildBreakdown(reviews),
    review_digest: await cachedReviewDigest(bookId, total),
  };
}

export async function getAllReviews(viewerId: string): Promise<ReviewOut[]> {
  const reviews = await repository.listAll();
  return reviews.map((review) => reviewToJson(review, viewerId));
}

export async function getMyReviews(memberId: string): Promise<ReviewOut[]> {
  const reviews = await repository.listForMember(memberId);
  return reviews.map((review) => reviewToJson(review, memberId));
}

export async function createReview(
  bookId: string,
  memberId: string,
  payload: ReviewCreateInput,
): Promise<ReviewOut> {
  let review: ReviewWithRelations;
  try {
    review = await repository.create({
      bookId,
      memberId,
      rating: payload.rating,
      comment: payload.comment,
      images: payload.images,
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === 'P2002') {
        throw new HttpError(409, "You've already reviewed this book — edit your review instead");
      }
      if (err.code === 'P2003') {
        throw new HttpError(404, 'Book not found');
      }
    }
    throw err;
  }
  return reviewToJson(review, memberId);
}

export async function updateReview(
  reviewId: string,
  memberId: string,
  payload: ReviewUpdateInput,
): Promise<ReviewOut> {
  const existing = await repository.findById(reviewId);
  if (!existing) throw new HttpError(404, 'Review not found');
  if (existing.memberId !== memberId) {
    throw new HttpError(403, 'You can only edit your own review');
  }

  const updated = await repository.update(reviewId, {
    rating: payload.rating,
    comment: payload.comment,
    images: payload.images,
  });
  return reviewToJson(updated, memberId);
}

export async function deleteReview(
  reviewId: string,
  userId: string,
  userRole: string,
): Promise<void> {
  const existing = await repository.findById(reviewId);
  if (!existing) throw new HttpError(404, 'Review not found');
  if (existing.memberId !== userId && !MODERATOR_ROLES.has(userRole)) {
    throw new HttpError(403, "You can't delete this review");
  }
  await repository.remove(reviewId);
}
