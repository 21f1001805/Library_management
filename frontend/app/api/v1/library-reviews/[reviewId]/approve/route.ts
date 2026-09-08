import { NextResponse } from 'next/server';

import { withErrorHandling } from '@/server/http';
import { requireRole } from '@/server/auth/guards';
import { Role } from '@/server/constants';
import * as libraryReviewsService from '@/server/libraryReviews/service';

export const POST = withErrorHandling(async (request, { params }) => {
  const user = await requireRole(request, Role.ADMIN);
  const { reviewId } = await params;
  const review = await libraryReviewsService.approveReview(reviewId as string, user.id);
  return NextResponse.json(review);
});
