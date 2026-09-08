import { NextResponse } from 'next/server';

import { withErrorHandling, readJsonBody } from '@/server/http';
import { requireRole } from '@/server/auth/guards';
import { Role } from '@/server/constants';
import { permissionRequestCreateSchema } from '@/server/permissionRequests/schemas';
import * as permissionRequestsService from '@/server/permissionRequests/service';

export const GET = withErrorHandling(async (request) => {
  await requireRole(request, Role.IT_HEAD);
  const requests = await permissionRequestsService.listPendingRequests();
  return NextResponse.json(requests);
});

export const POST = withErrorHandling(async (request) => {
  const user = await requireRole(request, Role.MANAGER, Role.LIBRARIAN);
  const payload = permissionRequestCreateSchema.parse(await readJsonBody(request));
  const created = await permissionRequestsService.createRequest(user.id, payload);
  return NextResponse.json(created, { status: 201 });
});
