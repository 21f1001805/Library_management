import { NextResponse } from 'next/server';

import { withErrorHandling, readJsonBody } from '@/server/http';
import { requireRole } from '@/server/auth/guards';
import { enforceRateLimit } from '@/server/rateLimit';
import { Role } from '@/server/constants';
import { suggestDescriptionRequestSchema } from '@/server/books/schemas';
import * as booksService from '@/server/books/service';

export const POST = withErrorHandling(async (request) => {
  await requireRole(request, Role.ADMIN, Role.LIBRARIAN, Role.MANAGER);
  await enforceRateLimit(request, 'books:suggest-description', 10, 60);
  const payload = suggestDescriptionRequestSchema.parse(await readJsonBody(request));
  const description = await booksService.suggestDescription(payload);
  return NextResponse.json({ description });
});
