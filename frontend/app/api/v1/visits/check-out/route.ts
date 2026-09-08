import { NextResponse } from 'next/server';

import { withErrorHandling, readJsonBody } from '@/server/http';
import { requireRole } from '@/server/auth/guards';
import { Role } from '@/server/constants';
import { checkOutCreateSchema } from '@/server/visits/schemas';
import * as visitsService from '@/server/visits/service';

export const POST = withErrorHandling(async (request) => {
  const user = await requireRole(request, Role.MANAGER, Role.LIBRARIAN, Role.ADMIN);
  const payload = checkOutCreateSchema.parse(await readJsonBody(request));
  const visit = await visitsService.checkOutMember(user, payload.member_id);
  return NextResponse.json(visit);
});
