import { z } from 'zod';

import type { Coupon } from '@prisma/client';

// Mirrors backend/src/app/modules/coupons/schemas.py.
export const couponCreateSchema = z.object({
  discount_percent: z.number().int().positive().max(100),
  max_uses: z.number().int().positive(),
});
export type CouponCreateInput = z.infer<typeof couponCreateSchema>;

export interface CouponOut {
  id: string;
  code: string;
  discount_percent: number;
  max_uses: number;
  uses_count: number;
  created_at: string;
}

export function couponToJson(coupon: Coupon): CouponOut {
  return {
    id: coupon.id,
    code: coupon.code,
    discount_percent: coupon.discountPercent,
    max_uses: coupon.maxUses,
    uses_count: coupon.usesCount,
    created_at: coupon.createdAt.toISOString(),
  };
}

export interface CouponValidationOut {
  code: string;
  discount_percent: number;
}
