import { NextResponse } from 'next/server';

import { withErrorHandling } from '@/server/http';
import { getCurrentUser } from '@/server/auth/guards';
import * as wishlistService from '@/server/wishlist/service';

export const POST = withErrorHandling(async (request, { params }) => {
  const user = await getCurrentUser(request);
  const { bookId } = await params;
  await wishlistService.addToWishlist(user.id, bookId as string);
  return new NextResponse(null, { status: 204 });
});

export const DELETE = withErrorHandling(async (request, { params }) => {
  const user = await getCurrentUser(request);
  const { bookId } = await params;
  await wishlistService.removeFromWishlist(user.id, bookId as string);
  return new NextResponse(null, { status: 204 });
});
