import { NextResponse } from 'next/server';

import { withErrorHandling } from '@/server/http';
import { getCurrentUser } from '@/server/auth/guards';
import * as communityService from '@/server/community/service';

export const POST = withErrorHandling(async (request, { params }) => {
  const user = await getCurrentUser(request);
  const { targetUserId } = await params;
  await communityService.banAuthor(user, targetUserId as string);
  return new NextResponse(null, { status: 204 });
});

export const DELETE = withErrorHandling(async (request, { params }) => {
  const user = await getCurrentUser(request);
  const { targetUserId } = await params;
  await communityService.unbanAuthor(user, targetUserId as string);
  return new NextResponse(null, { status: 204 });
});
