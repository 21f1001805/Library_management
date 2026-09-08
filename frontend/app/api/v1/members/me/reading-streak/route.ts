import { NextResponse } from 'next/server';

import { withErrorHandling } from '@/server/http';
import { getCurrentUser } from '@/server/auth/guards';
import * as membersService from '@/server/members/service';

// Mirrors backend/src/app/modules/members/router.py.

export const GET = withErrorHandling(async (request) => {
  const user = await getCurrentUser(request);
  const streak = await membersService.getReadingStreak(user.id);
  return NextResponse.json(streak);
});
