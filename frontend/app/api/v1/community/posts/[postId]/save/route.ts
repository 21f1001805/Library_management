import { NextResponse } from 'next/server';

import { withErrorHandling } from '@/server/http';
import { getCurrentUser } from '@/server/auth/guards';
import * as communityService from '@/server/community/service';

export const POST = withErrorHandling(async (request, { params }) => {
  const user = await getCurrentUser(request);
  const { postId } = await params;
  const post = await communityService.toggleSave(user, postId as string);
  return NextResponse.json(post);
});
