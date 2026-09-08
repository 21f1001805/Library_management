import { NextResponse } from 'next/server';

import { withErrorHandling } from '@/server/http';
import { getCurrentUser } from '@/server/auth/guards';
import * as membersService from '@/server/members/service';

// Mirrors backend/src/app/modules/members/router.py. LLM-backed — see
// src/server/members/readingProfile.ts.

export const GET = withErrorHandling(async (request) => {
  const user = await getCurrentUser(request);
  const profile = await membersService.getReadingProfile(user);
  return NextResponse.json(profile);
});
