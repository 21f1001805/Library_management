import { NextResponse } from 'next/server';

import { withErrorHandling } from '@/server/http';
import { requireRole } from '@/server/auth/guards';
import { Role } from '@/server/constants';
import * as loansService from '@/server/loans/service';

export const POST = withErrorHandling(async (request, { params }) => {
  await requireRole(request, Role.ADMIN, Role.MANAGER, Role.LIBRARIAN, Role.IT_HEAD);
  const { loanId } = await params;
  await loansService.sendReminder(loanId as string);
  return new NextResponse(null, { status: 204 });
});
