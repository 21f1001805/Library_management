import { NextResponse } from 'next/server';

import { withErrorHandling, readJsonBody } from '@/server/http';
import { requireRole } from '@/server/auth/guards';
import { enforceRateLimit } from '@/server/rateLimit';
import { Role } from '@/server/constants';
import { identifyCoverRequestSchema } from '@/server/books/schemas';
import * as booksService from '@/server/books/service';

export const POST = withErrorHandling(async (request) => {
  await requireRole(request, Role.ADMIN, Role.LIBRARIAN, Role.MANAGER);
  await enforceRateLimit(request, 'books:identify-cover', 10, 60);
  const payload = identifyCoverRequestSchema.parse(await readJsonBody(request));
  const fields = await booksService.identifyCover(payload);
  return NextResponse.json(fields);
});
