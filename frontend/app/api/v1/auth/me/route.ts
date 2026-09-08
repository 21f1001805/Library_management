import { NextResponse } from 'next/server';

import { withErrorHandling, readJsonBody } from '@/server/http';
import { enforceRateLimit } from '@/server/rateLimit';
import { updateProfileSchema } from '@/server/auth/schemas';
import { getCurrentUser } from '@/server/auth/guards';
import { setAuthCookies, clearAuthCookies } from '@/server/auth/cookies';
import * as authService from '@/server/auth/service';

export const PATCH = withErrorHandling(async (request) => {
  await enforceRateLimit(request, 'auth:update-profile', 10, 60);
  const user = await getCurrentUser(request);
  const payload = updateProfileSchema.parse(await readJsonBody(request));
  const tokenResponse = await authService.updateProfile(user, payload);
  await setAuthCookies({
    accessToken: tokenResponse.access_token,
    refreshToken: tokenResponse.refresh_token,
    role: tokenResponse.user.role.name,
  });
  return NextResponse.json(tokenResponse);
});

export const DELETE = withErrorHandling(async (request) => {
  const user = await getCurrentUser(request);
  await authService.deleteAccount(user);
  await clearAuthCookies();
  return new NextResponse(null, { status: 204 });
});
