import { NextResponse } from 'next/server';

import { withErrorHandling } from '@/server/http';
import { requireRole } from '@/server/auth/guards';
import { Role } from '@/server/constants';
import * as guardianService from '@/server/guardian/service';

export const POST = withErrorHandling(async (request, { params }) => {
  const user = await requireRole(request, Role.GUARDIAN);
  const { childId } = await params;
  await guardianService.payChildFines(user.id, childId as string);
  return new NextResponse(null, { status: 204 });
});
