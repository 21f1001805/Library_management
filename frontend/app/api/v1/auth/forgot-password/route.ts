import { NextResponse } from 'next/server';

import { withErrorHandling, readJsonBody } from '@/server/http';
import { enforceRateLimit } from '@/server/rateLimit';
import { forgotPasswordSchema } from '@/server/auth/schemas';
import * as authService from '@/server/auth/service';

export const POST = withErrorHandling(async (request) => {
  await enforceRateLimit(request, 'auth:forgot-password', 3, 60);
  const payload = forgotPasswordSchema.parse(await readJsonBody(request));
  await authService.forgotPassword(payload);
  return new NextResponse(null, { status: 204 });
});
