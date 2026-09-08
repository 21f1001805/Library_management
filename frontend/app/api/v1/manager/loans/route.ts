import { NextResponse } from 'next/server';

import { withErrorHandling, readJsonBody } from '@/server/http';
import { requireRole } from '@/server/auth/guards';
import { Role } from '@/server/constants';
import { managerLoanCreateSchema } from '@/server/manager/schemas';
import * as managerService from '@/server/manager/service';

// Manager-scoped convenience wrapper around the same loans_service.createLoan used by
// POST /loans (ADMIN/MANAGER/LIBRARIAN/IT_HEAD) — see manager/service.ts. Both are
// intentionally reachable by a manager: this one is the front-desk flow (issue while a
// member is standing there), POST /loans is the general staff endpoint.
export const POST = withErrorHandling(async (request) => {
  const user = await requireRole(request, Role.MANAGER, Role.LIBRARIAN);
  const payload = managerLoanCreateSchema.parse(await readJsonBody(request));
  const loan = await managerService.issueLoanForMember(user.id, payload);
  return NextResponse.json(loan, { status: 201 });
});
