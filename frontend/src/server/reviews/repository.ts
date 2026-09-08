import { Prisma } from '@prisma/client';

import { prisma } from '@/server/db';

// Mirrors backend/src/app/modules/reviews/repository.py.
const REVIEW_INCLUDE = { book: true, member: true } satisfies Prisma.ReviewInclude;
export type ReviewWithRelations = Prisma.ReviewGetPayload<{ include: typeof REVIEW_INCLUDE }>;

// list_for_book() is naturally bounded (one book's reviews) and left uncapped;
// list_all() backs the staff moderation queue across every book, so it isn't.
const LIST_LIMIT = 200;

export async function listForBook(bookId: string): Promise<ReviewWithRelations[]> {
  return prisma.review.findMany({
    where: { bookId },
    include: REVIEW_INCLUDE,
    orderBy: { createdAt: 'desc' },
  });
}

export async function listForMember(memberId: string): Promise<ReviewWithRelations[]> {
  return prisma.review.findMany({
    where: { memberId },
    include: REVIEW_INCLUDE,
    orderBy: { createdAt: 'desc' },
  });
}

export async function listAll(): Promise<ReviewWithRelations[]> {
  return prisma.review.findMany({
    include: REVIEW_INCLUDE,
    orderBy: { createdAt: 'desc' },
    take: LIST_LIMIT,
  });
}

export async function findById(reviewId: string): Promise<ReviewWithRelations | null> {
  return prisma.review.findUnique({ where: { id: reviewId }, include: REVIEW_INCLUDE });
}

export async function create(opts: {
  bookId: string;
  memberId: string;
  rating: number;
  comment: string;
  images: string[];
}): Promise<ReviewWithRelations> {
  return prisma.review.create({
    data: {
      bookId: opts.bookId,
      memberId: opts.memberId,
      rating: opts.rating,
      comment: opts.comment,
      images: opts.images,
    },
    include: REVIEW_INCLUDE,
  });
}

export async function update(
  reviewId: string,
  opts: { rating: number; comment: string; images: string[] },
): Promise<ReviewWithRelations> {
  return prisma.review.update({
    where: { id: reviewId },
    data: { rating: opts.rating, comment: opts.comment, images: opts.images },
    include: REVIEW_INCLUDE,
  });
}

export async function remove(reviewId: string): Promise<void> {
  await prisma.review.delete({ where: { id: reviewId } });
}
