import { NextResponse } from 'next/server';

import { withErrorHandling } from '@/server/http';
import { requireRole } from '@/server/auth/guards';
import { Role } from '@/server/constants';
import * as itHeadService from '@/server/itHead/service';

export const GET = withErrorHandling(async (request) => {
  await requireRole(request, Role.IT_HEAD);
  const dashboard = await itHeadService.getDashboard();
  return NextResponse.json(dashboard);
});
