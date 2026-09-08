import type { Prisma } from '@prisma/client';

import { prisma } from '@/server/db';

// Mirrors backend/src/app/modules/billing_requests/repository.py in full — the
// countPending() used by the manager dashboard was ported in phase 5.
const INCLUDE = { member: true, createdBy: true } satisfies Prisma.BillingRequestInclude;
export type BillingRequestWithRelations = Prisma.BillingRequestGetPayload<{ include: typeof INCLUDE }>;

// Self-limiting in practice — approved/rejected requests leave this filter — but capped
// anyway rather than trusting that a growing backlog never outpaces it.
const LIST_LIMIT = 200;

export async function countPending(): Promise<number> {
  return prisma.billingRequest.count({ where: { status: 'pending' } });
}

export async function listPending(): Promise<BillingRequestWithRelations[]> {
  return prisma.billingRequest.findMany({
    where: { status: 'pending' },
    include: INCLUDE,
    orderBy: { createdAt: 'asc' },
    take: LIST_LIMIT,
  });
}

export async function findById(requestId: string): Promise<BillingRequestWithRelations | null> {
  return prisma.billingRequest.findUnique({ where: { id: requestId }, include: INCLUDE });
}

export async function create(opts: {
  memberId: string;
  createdById: string;
  type: string;
  amount: number;
  reason: string;
}): Promise<BillingRequestWithRelations> {
  return prisma.billingRequest.create({
    data: {
      memberId: opts.memberId,
      createdById: opts.createdById,
      type: opts.type,
      amount: opts.amount,
      reason: opts.reason,
    },
    include: INCLUDE,
  });
}

export async function decide(
  requestId: string,
  opts: { status: string; decidedById: string },
): Promise<BillingRequestWithRelations> {
  return prisma.billingRequest.update({
    where: { id: requestId },
    data: { status: opts.status, decidedById: opts.decidedById, decidedAt: new Date() },
    include: INCLUDE,
  });
}

export async function decideIfPending(
  requestId: string,
  opts: { status: string; decidedById: string; client: Prisma.TransactionClient },
): Promise<BillingRequestWithRelations | null> {
  const updated = await opts.client.billingRequest.updateMany({
    where: { id: requestId, status: 'pending' },
    data: { status: opts.status, decidedById: opts.decidedById, decidedAt: new Date() },
  });
  if (updated.count !== 1) return null;
  return opts.client.billingRequest.findUnique({ where: { id: requestId }, include: INCLUDE });
}
