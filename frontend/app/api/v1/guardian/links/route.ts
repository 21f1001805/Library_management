import { NextResponse } from 'next/server';

import { withErrorHandling, readJsonBody } from '@/server/http';
import { requireRole } from '@/server/auth/guards';
import { Role } from '@/server/constants';
import { guardianLinkCreateSchema } from '@/server/guardian/schemas';
import * as guardianService from '@/server/guardian/service';

export const POST = withErrorHandling(async (request) => {
  await requireRole(request, Role.ADMIN, Role.LIBRARIAN, Role.MANAGER);
  const payload = guardianLinkCreateSchema.parse(await readJsonBody(request));
  await guardianService.linkChild(payload);
  return new NextResponse(null, { status: 201 });
});
