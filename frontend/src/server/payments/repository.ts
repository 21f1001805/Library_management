import type { Payment } from '@prisma/client';

import { prisma } from '@/server/db';

// Minimal read-only subset of backend/src/app/modules/payments/repository.py — the
// listing queries admin/it_head/guardian dashboards need. Order creation, Razorpay
// verification, and the webhook flow are phase 6 (billing & growth).
export async function listMembershipPayments(userId: string): Promise<Payment[]> {
  return prisma.payment.findMany({
    where: { userId, planMonths: { not: null }, status: 'success' },
    orderBy: { createdAt: 'asc' },
  });
}

export async function listPaymentsForUser(opts: {
  userId: string;
  page: number;
  pageSize: number;
}): Promise<[Payment[], number]> {
  const total = await prisma.payment.count({ where: { userId: opts.userId } });
  const items = await prisma.payment.findMany({
    where: { userId: opts.userId },
    orderBy: { createdAt: 'desc' },
    skip: (opts.page - 1) * opts.pageSize,
    take: opts.pageSize,
  });
  return [items, total];
}

// All successful plan payments per member, oldest first — matches the ordering
// calculate_membership_expiry expects.
export async function listMembershipPaymentsByMember(
  memberIds: string[],
): Promise<Map<string, Payment[]>> {
  if (memberIds.length === 0) return new Map();
  const payments = await prisma.payment.findMany({
    where: { userId: { in: memberIds }, status: 'success', planMonths: { not: null } },
    orderBy: { createdAt: 'asc' },
  });
  const byMember = new Map<string, Payment[]>();
  for (const payment of payments) {
    const list = byMember.get(payment.userId) ?? [];
    list.push(payment);
    byMember.set(payment.userId, list);
  }
  return byMember;
}

export async function listAllMembershipPayments(): Promise<Payment[]> {
  return prisma.payment.findMany({
    where: { status: 'success', planMonths: { not: null } },
    orderBy: { createdAt: 'desc' },
  });
}
