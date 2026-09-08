import { NextResponse } from 'next/server';

import { withErrorHandling } from '@/server/http';
import { getCurrentUser } from '@/server/auth/guards';
import * as loansService from '@/server/loans/service';

export const GET = withErrorHandling(async (request) => {
  const user = await getCurrentUser(request);
  const loans = await loansService.listMyLoans(user.id);
  return NextResponse.json(loans);
});
