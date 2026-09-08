import { NextResponse } from 'next/server';

import { withErrorHandling, readJsonBody } from '@/server/http';
import { requireRole } from '@/server/auth/guards';
import { Role } from '@/server/constants';
import { billingRequestCreateSchema } from '@/server/billingRequests/schemas';
import * as billingRequestsService from '@/server/billingRequests/service';

export const GET = withErrorHandling(async (request) => {
  await requireRole(request, Role.ADMIN);
  const requests = await billingRequestsService.listPendingRequests();
  return NextResponse.json(requests);
});

export const POST = withErrorHandling(async (request) => {
  const user = await requireRole(request, Role.MANAGER);
  const payload = billingRequestCreateSchema.parse(await readJsonBody(request));
  const created = await billingRequestsService.createRequest(user.id, payload);
  return NextResponse.json(created, { status: 201 });
});
