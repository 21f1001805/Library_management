import { NextResponse } from 'next/server';

import { withErrorHandling, readJsonBody } from '@/server/http';
import { getCurrentUser } from '@/server/auth/guards';
import { enforceRateLimit } from '@/server/rateLimit';
import { paymentCreateSchema } from '@/server/payments/schemas';
import * as paymentsService from '@/server/payments/service';

export const POST = withErrorHandling(async (request) => {
  const user = await getCurrentUser(request);
  await enforceRateLimit(request, 'payments:razorpay-order', 10, 60);
  const payload = paymentCreateSchema.parse(await readJsonBody(request));
  const order = await paymentsService.createRazorpayOrder(user, payload);
  return NextResponse.json(order, { status: 201 });
});
