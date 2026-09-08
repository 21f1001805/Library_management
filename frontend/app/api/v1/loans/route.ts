import { NextResponse } from 'next/server';

import { withErrorHandling, readJsonBody } from '@/server/http';
import { requireRole } from '@/server/auth/guards';
import { Role } from '@/server/constants';
import { loanCreateSchema } from '@/server/loans/schemas';
import * as loansService from '@/server/loans/service';

export const POST = withErrorHandling(async (request) => {
  const user = await requireRole(request, Role.ADMIN, Role.MANAGER, Role.LIBRARIAN, Role.IT_HEAD);
  const payload = loanCreateSchema.parse(await readJsonBody(request));
  const loan = await loansService.createLoan(user.id, payload);
  return NextResponse.json(loan, { status: 201 });
});

export const GET = withErrorHandling(async (request) => {
  await requireRole(request, Role.ADMIN, Role.MANAGER, Role.LIBRARIAN, Role.IT_HEAD);
  const loans = await loansService.listActiveLoans();
  return NextResponse.json(loans);
});
