import { NextResponse } from 'next/server';

import { withErrorHandling } from '@/server/http';
import { requireRole } from '@/server/auth/guards';
import { Role } from '@/server/constants';
import * as managerService from '@/server/manager/service';

export const GET = withErrorHandling(async (request) => {
  await requireRole(request, Role.MANAGER, Role.LIBRARIAN);
  const risk = await managerService.getLateReturnRisk();
  return NextResponse.json(risk);
});
