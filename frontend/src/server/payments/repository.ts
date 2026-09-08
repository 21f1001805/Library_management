import type { Payment, Prisma } from '@prisma/client';

import { prisma } from '@/server/db';

// Mirrors backend/src/app/modules/payments/repository.py in full — the read-only
// listing subset was ported in phase 5 for admin/it_head/guardian dashboards; the
// create/find-by-gateway-id pieces below are what phase 6's order/verify flow needs.
export async function createPayment(opts: {
  userId: string;
  amount: number;
  label: string;
  planMonths?: number | null;
  razorpayPaymentId?: string | null;
  razorpayOrderId?: string | null;
  client?: Prisma.TransactionClient;
}): Promise<Payment> {
  const db = opts.client ?? prisma;
  return db.payment.create({
    data: {
      userId: opts.userId,
      amount: opts.amount,
      label: opts.label,
      planMonths: opts.planMonths ?? null,
      razorpayPaymentId: opts.razorpayPaymentId ?? null,
      razorpayOrderId: opts.razorpayOrderId ?? null,
    },
  });
}

export async function findByRazorpayPaymentId(
  razorpayPaymentId: string,
  client?: Prisma.TransactionClient,
): Promise<Payment | null> {
  const db = client ?? prisma;
  return db.payment.findUnique({ where: { razorpayPaymentId } });
}

export async function findLatestMembershipPayment(userId: string): Promise<Payment | null> {
  return prisma.payment.findFirst({
    where: { userId, planMonths: { not: null }, status: 'success' },
    orderBy: { createdAt: 'desc' },
  });
}

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
