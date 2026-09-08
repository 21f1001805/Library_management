import { NextResponse } from 'next/server';

import { withErrorHandling } from '@/server/http';
import { getCurrentUser } from '@/server/auth/guards';
import * as reviewsService from '@/server/reviews/service';

export const GET = withErrorHandling(async (request) => {
  const user = await getCurrentUser(request);
  const reviews = await reviewsService.getMyReviews(user.id);
  return NextResponse.json(reviews);
});
