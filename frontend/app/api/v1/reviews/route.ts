import { NextResponse } from 'next/server';

import { withErrorHandling } from '@/server/http';
import { requireRole } from '@/server/auth/guards';
import { Role } from '@/server/constants';
import * as reviewsService from '@/server/reviews/service';

export const GET = withErrorHandling(async (request) => {
  const user = await requireRole(request, Role.ADMIN, Role.MANAGER, Role.LIBRARIAN, Role.IT_HEAD);
  const reviews = await reviewsService.getAllReviews(user.id);
  return NextResponse.json(reviews);
});
