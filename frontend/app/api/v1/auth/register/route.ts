import { NextResponse } from 'next/server';

import { withErrorHandling, readJsonBody } from '@/server/http';
import { enforceRateLimit } from '@/server/rateLimit';
import { registerSchema } from '@/server/auth/schemas';
import { setAuthCookies } from '@/server/auth/cookies';
import * as authService from '@/server/auth/service';

export const POST = withErrorHandling(async (request) => {
  await enforceRateLimit(request, 'auth:register', 5, 60);
  const payload = registerSchema.parse(await readJsonBody(request));
  const tokenResponse = await authService.register(payload);
  await setAuthCookies({
    accessToken: tokenResponse.access_token,
    refreshToken: tokenResponse.refresh_token,
    role: tokenResponse.user.role.name,
  });
  return NextResponse.json(tokenResponse, { status: 201 });
});
