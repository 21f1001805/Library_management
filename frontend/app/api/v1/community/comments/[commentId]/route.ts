import { NextResponse } from 'next/server';

import { withErrorHandling } from '@/server/http';
import { getCurrentUser } from '@/server/auth/guards';
import * as communityService from '@/server/community/service';

export const DELETE = withErrorHandling(async (request, { params }) => {
  const user = await getCurrentUser(request);
  const { commentId } = await params;
  await communityService.deleteComment(user, commentId as string);
  return new NextResponse(null, { status: 204 });
});
