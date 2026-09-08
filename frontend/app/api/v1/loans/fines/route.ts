import { NextResponse } from 'next/server';

import { withErrorHandling } from '@/server/http';
import { requireRole } from '@/server/auth/guards';
import { Role } from '@/server/constants';
import * as loansService from '@/server/loans/service';

export const GET = withErrorHandling(async (request) => {
  await requireRole(request, Role.ADMIN, Role.MANAGER, Role.LIBRARIAN, Role.IT_HEAD);
  const loans = await loansService.listFines();
  return NextResponse.json(loans);
});
