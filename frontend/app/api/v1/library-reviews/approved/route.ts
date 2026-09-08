import { NextResponse } from 'next/server';

import { withErrorHandling } from '@/server/http';
import * as libraryReviewsService from '@/server/libraryReviews/service';

// Public — feeds the homepage's "What Our Members Say" section, no auth required.
export const GET = withErrorHandling(async () => {
  const reviews = await libraryReviewsService.listApprovedReviews();
  return NextResponse.json(reviews);
});
