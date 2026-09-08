import { NextResponse } from 'next/server';

import { withErrorHandling, readJsonBody } from '@/server/http';
import { getCurrentUser } from '@/server/auth/guards';
import { env } from '@/server/env';
import { paymentCreateSchema } from '@/server/payments/schemas';
import * as paymentsService from '@/server/payments/service';

export const POST = withErrorHandling(async (request) => {
  const user = await getCurrentUser(request);
  if (env.APP_ENV !== 'test') {
    return NextResponse.json({ detail: 'Direct payment recording is not available' }, { status: 404 });
  }
  const payload = paymentCreateSchema.parse(await readJsonBody(request));
  const payment = await paymentsService.createPayment(user, payload);
  return NextResponse.json(payment, { status: 201 });
});
