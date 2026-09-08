import { NextResponse } from 'next/server';

import { withErrorHandling } from '@/server/http';
import { requireRole } from '@/server/auth/guards';
import { Role } from '@/server/constants';
import * as adminService from '@/server/admin/service';

export const GET = withErrorHandling(async (request) => {
  await requireRole(request, Role.ADMIN);
  const result = await adminService.getExpenseBreakdown();
  return NextResponse.json(result);
});
