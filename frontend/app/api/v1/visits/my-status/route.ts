import { NextResponse } from 'next/server';

import { withErrorHandling } from '@/server/http';
import { getCurrentUser } from '@/server/auth/guards';
import * as visitsService from '@/server/visits/service';

export const GET = withErrorHandling(async (request) => {
  const user = await getCurrentUser(request);
  const status = await visitsService.getMemberStatus(user);
  return NextResponse.json(status);
});
