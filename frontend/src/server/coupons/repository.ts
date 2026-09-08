import type { Coupon, Prisma } from '@prisma/client';

import { prisma } from '@/server/db';

// Mirrors backend/src/app/modules/coupons/repository.py.
const LIST_LIMIT = 200;

export async function listAll(): Promise<Coupon[]> {
  return prisma.coupon.findMany({ orderBy: { createdAt: 'desc' }, take: LIST_LIMIT });
}

export async function findByCode(
  code: string,
  client?: Prisma.TransactionClient,
): Promise<Coupon | null> {
  const db = client ?? prisma;
  return db.coupon.findUnique({ where: { code } });
}

export async function create(opts: {
  code: string;
  discountPercent: number;
  maxUses: number;
  createdById: string;
}): Promise<Coupon> {
  return prisma.coupon.create({
    data: {
      code: opts.code,
      discountPercent: opts.discountPercent,
      maxUses: opts.maxUses,
      createdById: opts.createdById,
    },
  });
}

export async function incrementUses(couponId: string): Promise<Coupon> {
  return prisma.coupon.update({ where: { id: couponId }, data: { usesCount: { increment: 1 } } });
}

export async function incrementUsesIfAvailable(
  couponId: string,
  client: Prisma.TransactionClient,
): Promise<boolean> {
  const changed = await client.$executeRaw`
    UPDATE coupons
    SET uses_count = uses_count + 1
    WHERE id = ${couponId}::uuid AND uses_count < max_uses`;
  return changed === 1;
}
