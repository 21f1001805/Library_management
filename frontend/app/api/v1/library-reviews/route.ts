import { NextResponse } from 'next/server';

import { withErrorHandling, readJsonBody } from '@/server/http';
import { getCurrentUser, requireRole } from '@/server/auth/guards';
import { Role } from '@/server/constants';
import { libraryReviewCreateSchema } from '@/server/libraryReviews/schemas';
import * as libraryReviewsService from '@/server/libraryReviews/service';

export const GET = withErrorHandling(async (request) => {
  await requireRole(request, Role.ADMIN);
  const reviews = await libraryReviewsService.listPendingReviews();
  return NextResponse.json(reviews);
});

export const POST = withErrorHandling(async (request) => {
  const user = await getCurrentUser(request);
  const payload = libraryReviewCreateSchema.parse(await readJsonBody(request));
  const review = await libraryReviewsService.submitReview(user.id, payload);
  return NextResponse.json(review, { status: 201 });
});
