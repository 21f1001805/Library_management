import { NextResponse } from 'next/server';

import { withErrorHandling } from '@/server/http';
import { getCurrentUser } from '@/server/auth/guards';
import * as communityService from '@/server/community/service';

export const POST = withErrorHandling(async (request, { params }) => {
  const user = await getCurrentUser(request);
  const { commentId } = await params;
  await communityService.reportComment(user, commentId as string);
  return new NextResponse(null, { status: 204 });
});
