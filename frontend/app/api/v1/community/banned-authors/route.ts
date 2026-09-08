import { NextResponse } from 'next/server';

import { withErrorHandling } from '@/server/http';
import { getCurrentUser } from '@/server/auth/guards';
import * as communityService from '@/server/community/service';

export const GET = withErrorHandling(async (request) => {
  const user = await getCurrentUser(request);
  const banned = await communityService.listBannedAuthors(user);
  return NextResponse.json(banned);
});
