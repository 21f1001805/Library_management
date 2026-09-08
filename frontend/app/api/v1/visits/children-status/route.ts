import { NextResponse } from 'next/server';

import { withErrorHandling } from '@/server/http';
import { requireRole } from '@/server/auth/guards';
import { Role } from '@/server/constants';
import * as visitsService from '@/server/visits/service';

export const GET = withErrorHandling(async (request) => {
  const guardian = await requireRole(request, Role.GUARDIAN);
  const status = await visitsService.getChildrenStatus(guardian);
  return NextResponse.json(status);
});
