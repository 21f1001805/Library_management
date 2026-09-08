import { NextResponse } from 'next/server';

import { withErrorHandling, readJsonBody } from '@/server/http';
import { getCurrentUser } from '@/server/auth/guards';
import { postCreateSchema } from '@/server/community/schemas';
import * as communityService from '@/server/community/service';

export const PUT = withErrorHandling(async (request, { params }) => {
  const user = await getCurrentUser(request);
  const { postId } = await params;
  const payload = postCreateSchema.parse(await readJsonBody(request));
  const post = await communityService.updatePost(user, postId as string, payload);
  return NextResponse.json(post);
});

export const DELETE = withErrorHandling(async (request, { params }) => {
  const user = await getCurrentUser(request);
  const { postId } = await params;
  await communityService.deletePost(user, postId as string);
  return new NextResponse(null, { status: 204 });
});
