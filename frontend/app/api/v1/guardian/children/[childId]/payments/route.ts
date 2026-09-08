import { NextResponse } from 'next/server';

import { withErrorHandling } from '@/server/http';
import { requireRole } from '@/server/auth/guards';
import { Role } from '@/server/constants';
import * as guardianService from '@/server/guardian/service';

export const GET = withErrorHandling(async (request, { params }) => {
  const user = await requireRole(request, Role.GUARDIAN);
  const { childId } = await params;
  const payments = await guardianService.listChildPayments(user.id, childId as string);
  return NextResponse.json(payments);
});
