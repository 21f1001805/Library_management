import { NextResponse } from 'next/server';

import { withErrorHandling, readJsonBody } from '@/server/http';
import { requireRole } from '@/server/auth/guards';
import { Role } from '@/server/constants';
import { expenseCreateSchema } from '@/server/admin/schemas';
import * as adminService from '@/server/admin/service';

export const POST = withErrorHandling(async (request) => {
  const user = await requireRole(request, Role.ADMIN);
  const payload = expenseCreateSchema.parse(await readJsonBody(request));
  const expense = await adminService.logExpense(user.id, payload);
  return NextResponse.json(expense, { status: 201 });
});
