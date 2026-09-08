import { NextResponse } from 'next/server';

import { withErrorHandling, readJsonBody } from '@/server/http';
import { getCurrentUser } from '@/server/auth/guards';
import { enforceRateLimit } from '@/server/rateLimit';
import { razorpayVerifyRequestSchema } from '@/server/payments/schemas';
import * as paymentsService from '@/server/payments/service';

export const POST = withErrorHandling(async (request) => {
  const user = await getCurrentUser(request);
  await enforceRateLimit(request, 'payments:razorpay-verify', 10, 60);
  const payload = razorpayVerifyRequestSchema.parse(await readJsonBody(request));
  const payment = await paymentsService.verifyAndRecordRazorpayPayment(user, payload);
  return NextResponse.json(payment);
});
