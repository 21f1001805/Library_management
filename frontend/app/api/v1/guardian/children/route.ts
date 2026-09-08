import { NextResponse } from 'next/server';

import { withErrorHandling } from '@/server/http';
import { requireRole } from '@/server/auth/guards';
import { Role } from '@/server/constants';
import * as guardianService from '@/server/guardian/service';

export const GET = withErrorHandling(async (request) => {
  const user = await requireRole(request, Role.GUARDIAN);
  const children = await guardianService.listMyChildren(user.id);
  return NextResponse.json(children);
});
