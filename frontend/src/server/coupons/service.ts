import { randomInt } from 'node:crypto';

import { Prisma, type Coupon } from '@prisma/client';

import { HttpError } from '@/server/http';
import { AuditAction } from '@/server/auditLog/constants';
import * as auditLogService from '@/server/auditLog/service';
import * as repository from '@/server/coupons/repository';
import {
  couponToJson,
  type CouponCreateInput,
  type CouponOut,
  type CouponValidationOut,
} from '@/server/coupons/schemas';

// Mirrors backend/src/app/modules/coupons/service.py.
const CODE_LENGTH = 8;
const CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const MAX_GENERATION_ATTEMPTS = 5;

function generateCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return code;
}

export async function listCoupons(): Promise<CouponOut[]> {
  const rows = await repository.listAll();
  return rows.map(couponToJson);
}

export async function generateCoupon(adminId: string, payload: CouponCreateInput): Promise<CouponOut> {
  let row: Coupon | undefined;
  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
    try {
      row = await repository.create({
        code: generateCode(),
        discountPercent: payload.discount_percent,
        maxUses: payload.max_uses,
        createdById: adminId,
      });
      break;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') continue;
      throw err;
    }
  }
  if (!row) {
    throw new HttpError(500, 'Could not generate a unique coupon code, try again');
  }

  await auditLogService.record({
    actorId: adminId,
    action: AuditAction.COUPON_GENERATED,
    metadata: { code: row.code, discountPercent: row.discountPercent, maxUses: row.maxUses },
  });
  return couponToJson(row);
}

async function findValidCoupon(code: string, client?: Prisma.TransactionClient): Promise<Coupon> {
  const coupon = await repository.findByCode(code.trim().toUpperCase(), client);
  if (!coupon) throw new HttpError(404, 'Coupon not found');
  if (coupon.usesCount >= coupon.maxUses) {
    throw new HttpError(409, 'Coupon has been fully redeemed');
  }
  return coupon;
}

export async function validateCoupon(code: string): Promise<CouponValidationOut> {
  const coupon = await findValidCoupon(code);
  return { code: coupon.code, discount_percent: coupon.discountPercent };
}

// Reachable only through the test-only direct-payment endpoint. Production gateway
// verification uses consumeCoupon's conditional update.
export async function redeemCoupon(code: string, baseAmount: number): Promise<number> {
  const coupon = await findValidCoupon(code);
  await repository.incrementUses(coupon.id);
  return Math.round((baseAmount * (100 - coupon.discountPercent)) / 100);
}

// Consume one use only after payment verification, without exceeding maxUses.
export async function consumeCoupon(code: string, client: Prisma.TransactionClient): Promise<void> {
  const coupon = await findValidCoupon(code, client);
  if (!(await repository.incrementUsesIfAvailable(coupon.id, client))) {
    throw new HttpError(409, 'Coupon has been fully redeemed');
  }
}
