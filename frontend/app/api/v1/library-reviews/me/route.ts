import { NextResponse } from 'next/server';

import { withErrorHandling } from '@/server/http';
import { getCurrentUser } from '@/server/auth/guards';
import * as libraryReviewsService from '@/server/libraryReviews/service';

export const GET = withErrorHandling(async (request) => {
  const user = await getCurrentUser(request);
  const review = await libraryReviewsService.getMyReview(user.id);
  return NextResponse.json(review);
});
