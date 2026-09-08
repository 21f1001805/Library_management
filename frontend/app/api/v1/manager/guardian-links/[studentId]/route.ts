import { NextResponse } from 'next/server';

import { withErrorHandling } from '@/server/http';
import { requireRole } from '@/server/auth/guards';
import { Role } from '@/server/constants';
import * as managerService from '@/server/manager/service';

export const GET = withErrorHandling(async (request, { params }) => {
  await requireRole(request, Role.MANAGER, Role.LIBRARIAN);
  const { studentId } = await params;
  const guardian = await managerService.getStudentGuardian(studentId as string);
  return NextResponse.json(guardian);
});

export const DELETE = withErrorHandling(async (request, { params }) => {
  await requireRole(request, Role.MANAGER, Role.LIBRARIAN);
  const { studentId } = await params;
  await managerService.unlinkGuardian(studentId as string);
  return new NextResponse(null, { status: 204 });
});
