import { NextResponse } from 'next/server';

import { withErrorHandling, readJsonBody } from '@/server/http';
import { requireRole } from '@/server/auth/guards';
import { Role } from '@/server/constants';
import { waiveFineRequestSchema } from '@/server/billingRequests/schemas';
import * as billingRequestsService from '@/server/billingRequests/service';

export const POST = withErrorHandling(async (request) => {
  const user = await requireRole(request, Role.ADMIN);
  const payload = waiveFineRequestSchema.parse(await readJsonBody(request));
  const created = await billingRequestsService.waiveFine(user.id, payload);
  return NextResponse.json(created, { status: 201 });
});
