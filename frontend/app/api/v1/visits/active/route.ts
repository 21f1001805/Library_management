import { NextResponse } from 'next/server';

import { withErrorHandling } from '@/server/http';
import { requireRole } from '@/server/auth/guards';
import { Role } from '@/server/constants';
import * as visitsService from '@/server/visits/service';

export const GET = withErrorHandling(async (request) => {
  await requireRole(request, Role.MANAGER, Role.LIBRARIAN, Role.ADMIN);
  const visits = await visitsService.listActiveVisits();
  return NextResponse.json(visits);
});
