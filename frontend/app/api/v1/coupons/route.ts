import { NextResponse } from 'next/server';

import { withErrorHandling, readJsonBody } from '@/server/http';
import { requireRole } from '@/server/auth/guards';
import { Role } from '@/server/constants';
import { couponCreateSchema } from '@/server/coupons/schemas';
import * as couponsService from '@/server/coupons/service';

export const GET = withErrorHandling(async (request) => {
  await requireRole(request, Role.ADMIN);
  const coupons = await couponsService.listCoupons();
  return NextResponse.json(coupons);
});

export const POST = withErrorHandling(async (request) => {
  const user = await requireRole(request, Role.ADMIN);
  const payload = couponCreateSchema.parse(await readJsonBody(request));
  const coupon = await couponsService.generateCoupon(user.id, payload);
  return NextResponse.json(coupon, { status: 201 });
});
