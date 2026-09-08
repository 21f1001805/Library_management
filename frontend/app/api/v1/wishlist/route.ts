import { NextResponse } from 'next/server';

import { withErrorHandling } from '@/server/http';
import { getCurrentUser } from '@/server/auth/guards';
import * as wishlistService from '@/server/wishlist/service';

export const GET = withErrorHandling(async (request) => {
  const user = await getCurrentUser(request);
  const wishlist = await wishlistService.listWishlist(user.id);
  return NextResponse.json(wishlist);
});
