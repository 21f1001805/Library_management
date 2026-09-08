import { NextResponse } from 'next/server';

import { withErrorHandling } from '@/server/http';
import { requireRole } from '@/server/auth/guards';
import { Role } from '@/server/constants';
import * as billingRequestsService from '@/server/billingRequests/service';

export const POST = withErrorHandling(async (request, { params }) => {
  const user = await requireRole(request, Role.ADMIN);
  const { requestId } = await params;
  const result = await billingRequestsService.approveRequest(requestId as string, user.id);
  return NextResponse.json(result);
});
