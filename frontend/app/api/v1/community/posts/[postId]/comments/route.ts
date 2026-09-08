import { NextResponse } from 'next/server';

import { withErrorHandling, readJsonBody } from '@/server/http';
import { getCurrentUser } from '@/server/auth/guards';
import { commentCreateSchema } from '@/server/community/schemas';
import * as communityService from '@/server/community/service';

export const POST = withErrorHandling(async (request, { params }) => {
  const user = await getCurrentUser(request);
  const { postId } = await params;
  const payload = commentCreateSchema.parse(await readJsonBody(request));
  const post = await communityService.addComment(user, postId as string, payload);
  return NextResponse.json(post, { status: 201 });
});
