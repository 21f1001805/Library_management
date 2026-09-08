import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { Prisma } from '@prisma/client';

import { HttpError } from '@/server/http';
import { Role } from '@/server/constants';
import { buildChatLlm, logLlmFailure } from '@/server/llm';
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

// Mirrors backend/src/app/modules/reviews/service.py in full.
const MODERATOR_ROLES = new Set<string>([Role.ADMIN, Role.IT_HEAD]);

const DIGEST_SYSTEM_PROMPT = `You summarize real reader reviews for a library catalog page.

Given a book's title and a list of its reviews (rating + comment), write a 2-3 sentence
summary of what reviewers actually said — the real throughline of praise and criticism
across them. Rules:
- Base this ONLY on the review text given. Never invent an opinion, a plot detail, or a
  fact that isn't actually present in the reviews.
- No spoilers.
- Plain prose only: no headings, no bullet points, no quotation marks around the whole
  thing, and don't just restate the star rating as a number.
- Output only the summary text, nothing else.`;

// Bounds prompt size for books with a lot of reviews — the most recent N is a
// reasonable proxy for "current sentiment" without needing every review ever written.
const MAX_REVIEWS_IN_DIGEST = 20;

// Best-effort — a stale or missing digest degrades the page, not the endpoint. Unlike
// suggestDescription (its own dedicated staff action), this is supplementary data
// riding along with the review list, so a failure here must not turn a normal
// GET /books/{id}/reviews into an error.
async function generateDigest(bookTitle: string, reviews: ReviewWithRelations[]): Promise<string | null> {
  const sample = reviews.slice(0, MAX_REVIEWS_IN_DIGEST);
  const reviewLines = sample.map((review) => `- ${review.rating}/5: ${review.comment}`).join('\n');
  const human = `Book: ${bookTitle}\n\nReviews:\n${reviewLines}`;

  let result;
  try {
    const llm = await buildChatLlm();
    result = await llm.invoke([new SystemMessage(DIGEST_SYSTEM_PROMPT), new HumanMessage(human)]);
  } catch (exc) {
    logLlmFailure('review_digest', exc, { book: bookTitle, reviews: sample.length });
    return null;
  }

  const digest = String(result.content).trim();
  return digest || null;
}

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

async function reviewDigest(
  bookId: string,
  reviews: ReviewWithRelations[],
  total: number,
): Promise<string | null> {
  if (total === 0) return null;
  const book = await booksRepository.findById(bookId);
  if (!book) return null;
  // A cache hit is "the digest already covers exactly this many reviews" — any change
  // to the review count (new review, edit doesn't change count, delete) invalidates it.
  if (book.reviewDigest !== null && book.reviewDigestReviewCount === total) {
    return book.reviewDigest;
  }

  const digest = await generateDigest(book.title, reviews);
  if (digest !== null) {
    await booksRepository.saveReviewDigest(bookId, { digest, reviewCount: total });
  }
  return digest;
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
    review_digest: await reviewDigest(bookId, reviews, total),
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
