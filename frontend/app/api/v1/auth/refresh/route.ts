import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { withErrorHandling, readJsonBody } from '@/server/http';
import { enforceRateLimit } from '@/server/rateLimit';
import { refreshSchema } from '@/server/auth/schemas';
import { REFRESH_COOKIE, setAuthCookies } from '@/server/auth/cookies';
import * as authService from '@/server/auth/service';

export const POST = withErrorHandling(async (request) => {
  await enforceRateLimit(request, 'auth:refresh', 10, 60);

  const body = await readJsonBody(request);
  const payload = body === undefined ? null : refreshSchema.parse(body);

  // httpOnly cookie first (the browser sends it automatically); the body is a fallback
  // for callers that don't use cookies (tools/tests, or the FastAPI backend during
  // coexistence).
  const store = await cookies();
  const token = store.get(REFRESH_COOKIE)?.value ?? payload?.refresh_token;
  if (!token) throw authService.invalidRefreshToken();

  const tokenResponse = await authService.refresh(token);
  await setAuthCookies({
    accessToken: tokenResponse.access_token,
    refreshToken: tokenResponse.refresh_token,
    role: tokenResponse.user.role.name,
  });
  return NextResponse.json(tokenResponse);
});
