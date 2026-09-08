import { NextResponse } from 'next/server';

import { withErrorHandling, readJsonBody } from '@/server/http';
import { getCurrentUser } from '@/server/auth/guards';
import { reviewCreateSchema } from '@/server/reviews/schemas';
import * as reviewsService from '@/server/reviews/service';

export const GET = withErrorHandling(async (request, { params }) => {
  const user = await getCurrentUser(request);
  const { bookId } = await params;
  const result = await reviewsService.getBookReviews(bookId as string, user.id);
  return NextResponse.json(result);
});

export const POST = withErrorHandling(async (request, { params }) => {
  const user = await getCurrentUser(request);
  const { bookId } = await params;
  const payload = reviewCreateSchema.parse(await readJsonBody(request));
  const review = await reviewsService.createReview(bookId as string, user.id, payload);
  return NextResponse.json(review, { status: 201 });
});
