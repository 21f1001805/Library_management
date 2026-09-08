import { NextResponse } from 'next/server';

import { withErrorHandling, readJsonBody } from '@/server/http';
import { getCurrentUser } from '@/server/auth/guards';
import { reviewUpdateSchema } from '@/server/reviews/schemas';
import * as reviewsService from '@/server/reviews/service';

export const PUT = withErrorHandling(async (request, { params }) => {
  const user = await getCurrentUser(request);
  const { reviewId } = await params;
  const payload = reviewUpdateSchema.parse(await readJsonBody(request));
  const review = await reviewsService.updateReview(reviewId as string, user.id, payload);
  return NextResponse.json(review);
});

export const DELETE = withErrorHandling(async (request, { params }) => {
  const user = await getCurrentUser(request);
  const { reviewId } = await params;
  await reviewsService.deleteReview(reviewId as string, user.id, user.role.name);
  return new NextResponse(null, { status: 204 });
});
