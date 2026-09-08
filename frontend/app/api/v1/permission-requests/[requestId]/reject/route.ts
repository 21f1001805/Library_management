import { NextResponse } from 'next/server';

import { withErrorHandling } from '@/server/http';
import { requireRole } from '@/server/auth/guards';
import { Role } from '@/server/constants';
import * as permissionRequestsService from '@/server/permissionRequests/service';

export const POST = withErrorHandling(async (request, { params }) => {
  const user = await requireRole(request, Role.IT_HEAD);
  const { requestId } = await params;
  const result = await permissionRequestsService.denyRequest(requestId as string, user.id);
  return NextResponse.json(result);
});
