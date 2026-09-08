import { NextResponse } from 'next/server';

import { withErrorHandling } from '@/server/http';
import { getCurrentUser } from '@/server/auth/guards';
import * as paymentsService from '@/server/payments/service';

export const GET = withErrorHandling(async (request) => {
  const user = await getCurrentUser(request);
  const membership = await paymentsService.getMyMembership(user.id);
  return NextResponse.json(membership);
});
