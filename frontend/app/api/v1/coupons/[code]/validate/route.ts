import { NextResponse } from 'next/server';

import { withErrorHandling } from '@/server/http';
import { getCurrentUser } from '@/server/auth/guards';
import * as couponsService from '@/server/coupons/service';

export const GET = withErrorHandling(async (request, { params }) => {
  await getCurrentUser(request);
  const { code } = await params;
  const result = await couponsService.validateCoupon(code as string);
  return NextResponse.json(result);
});
