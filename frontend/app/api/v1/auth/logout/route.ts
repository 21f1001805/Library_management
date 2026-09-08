import { NextResponse } from 'next/server';

import { withErrorHandling } from '@/server/http';
import { getCurrentUser } from '@/server/auth/guards';
import { clearAuthCookies } from '@/server/auth/cookies';
import * as authService from '@/server/auth/service';

export const POST = withErrorHandling(async (request) => {
  const user = await getCurrentUser(request);
  await authService.logout(user);
  await clearAuthCookies();
  return new NextResponse(null, { status: 204 });
});
