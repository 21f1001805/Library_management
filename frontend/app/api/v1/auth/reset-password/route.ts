import { NextResponse } from 'next/server';

import { withErrorHandling, readJsonBody } from '@/server/http';
import { enforceRateLimit } from '@/server/rateLimit';
import { resetPasswordSchema } from '@/server/auth/schemas';
import * as authService from '@/server/auth/service';

export const POST = withErrorHandling(async (request) => {
  await enforceRateLimit(request, 'auth:reset-password', 5, 60);
  const payload = resetPasswordSchema.parse(await readJsonBody(request));
  await authService.resetPassword(payload);
  return new NextResponse(null, { status: 204 });
});
