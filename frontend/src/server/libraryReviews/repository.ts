import type { Prisma } from '@prisma/client';

import { prisma } from '@/server/db';

// Mirrors backend/src/app/modules/library_reviews/repository.py.
const INCLUDE = { member: { include: { role: true } } } satisfies Prisma.LibraryReviewInclude;
export type LibraryReviewWithMember = Prisma.LibraryReviewGetPayload<{ include: typeof INCLUDE }>;

const LIST_LIMIT = 200;

export async function listPending(): Promise<LibraryReviewWithMember[]> {
  return prisma.libraryReview.findMany({
    where: { status: 'pending' },
    include: INCLUDE,
    orderBy: { createdAt: 'asc' },
    take: LIST_LIMIT,
  });
}

export async function listApproved(limit: number): Promise<LibraryReviewWithMember[]> {
  return prisma.libraryReview.findMany({
    where: { status: 'approved' },
    include: INCLUDE,
    orderBy: { decidedAt: 'desc' },
    take: limit,
  });
}

export async function findLatestForMember(memberId: string): Promise<LibraryReviewWithMember | null> {
  const rows = await prisma.libraryReview.findMany({
    where: { memberId },
    include: INCLUDE,
    orderBy: { createdAt: 'desc' },
    take: 1,
  });
  return rows[0] ?? null;
}

export async function findById(reviewId: string): Promise<LibraryReviewWithMember | null> {
  return prisma.libraryReview.findUnique({ where: { id: reviewId }, include: INCLUDE });
}

export async function create(opts: {
  memberId: string;
  rating: number;
  comment: string;
}): Promise<LibraryReviewWithMember> {
  return prisma.libraryReview.create({
    data: { memberId: opts.memberId, rating: opts.rating, comment: opts.comment },
    include: INCLUDE,
  });
}

export async function decideIfPending(
  reviewId: string,
  opts: { status: string; decidedById: string; client: Prisma.TransactionClient },
): Promise<LibraryReviewWithMember | null> {
  const updated = await opts.client.libraryReview.updateMany({
    where: { id: reviewId, status: 'pending' },
    data: { status: opts.status, decidedById: opts.decidedById, decidedAt: new Date() },
  });
  if (updated.count !== 1) return null;
  return opts.client.libraryReview.findUnique({ where: { id: reviewId }, include: INCLUDE });
}
