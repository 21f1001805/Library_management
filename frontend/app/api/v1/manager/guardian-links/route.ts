import { NextResponse } from 'next/server';

import { withErrorHandling, readJsonBody } from '@/server/http';
import { requireRole } from '@/server/auth/guards';
import { Role } from '@/server/constants';
import { managerGuardianLinkCreateSchema } from '@/server/manager/schemas';
import * as managerService from '@/server/manager/service';

export const POST = withErrorHandling(async (request) => {
  await requireRole(request, Role.MANAGER, Role.LIBRARIAN);
  const payload = managerGuardianLinkCreateSchema.parse(await readJsonBody(request));
  await managerService.linkGuardian(payload);
  return new NextResponse(null, { status: 204 });
});

// PUT rather than reusing POST: POST stays a strict create (409 if the student already
// has a guardian), this is the deliberate "change who it is" action.
export const PUT = withErrorHandling(async (request) => {
  await requireRole(request, Role.MANAGER, Role.LIBRARIAN);
  const payload = managerGuardianLinkCreateSchema.parse(await readJsonBody(request));
  await managerService.setGuardian(payload);
  return new NextResponse(null, { status: 204 });
});
