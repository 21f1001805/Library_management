import { prisma } from '@/server/db';
import { HttpError } from '@/server/http';
import { Role } from '@/server/constants';
import { AuditAction } from '@/server/auditLog/constants';
import * as auditLogService from '@/server/auditLog/service';
import * as notificationsService from '@/server/notifications/service';
import * as repository from '@/server/libraryReviews/repository';
import {
  libraryReviewToJson,
  type LibraryReviewCreateInput,
  type LibraryReviewOut,
} from '@/server/libraryReviews/schemas';

// Mirrors backend/src/app/modules/library_reviews/service.py.
const APPROVED_LIMIT = 20;

const DECISION_ACTIONS: Record<'approved' | 'rejected', string> = {
  approved: AuditAction.LIBRARY_REVIEW_APPROVED,
  rejected: AuditAction.LIBRARY_REVIEW_REJECTED,
};

export async function listPendingReviews(): Promise<LibraryReviewOut[]> {
  const rows = await repository.listPending();
  return rows.map(libraryReviewToJson);
}

export async function listApprovedReviews(): Promise<LibraryReviewOut[]> {
  const rows = await repository.listApproved(APPROVED_LIMIT);
  return rows.map(libraryReviewToJson);
}

export async function getMyReview(memberId: string): Promise<LibraryReviewOut | null> {
  const row = await repository.findLatestForMember(memberId);
  return row ? libraryReviewToJson(row) : null;
}

export async function submitReview(
  memberId: string,
  payload: LibraryReviewCreateInput,
): Promise<LibraryReviewOut> {
  // ponytail: no one-pending-per-member guard — a resubmit just files a new row rather
  // than editing in place.
  const row = await repository.create({
    memberId,
    rating: payload.rating,
    comment: payload.comment,
  });
  await notificationsService.notifyRoles(
    [Role.ADMIN],
    'pending-request',
    `${row.member.fullName} left a library review for approval.`,
  );
  return libraryReviewToJson(row);
}

export async function approveReview(reviewId: string, decidedById: string): Promise<LibraryReviewOut> {
  return decide(reviewId, decidedById, 'approved');
}

export async function rejectReview(reviewId: string, decidedById: string): Promise<LibraryReviewOut> {
  return decide(reviewId, decidedById, 'rejected');
}

async function decide(
  reviewId: string,
  decidedById: string,
  statusValue: 'approved' | 'rejected',
): Promise<LibraryReviewOut> {
  const existing = await repository.findById(reviewId);
  if (!existing) throw new HttpError(404, 'Review not found');
  if (existing.status !== 'pending') {
    throw new HttpError(409, 'This review has already been decided');
  }

  const row = await prisma.$transaction(async (tx) => {
    const decided = await repository.decideIfPending(reviewId, {
      status: statusValue,
      decidedById,
      client: tx,
    });
    if (!decided) throw new HttpError(409, 'This review has already been decided');
    await auditLogService.record({
      actorId: decidedById,
      action: DECISION_ACTIONS[statusValue],
      metadata: { memberName: decided.member.fullName },
      client: tx,
    });
    return decided;
  });

  return libraryReviewToJson(row);
}
