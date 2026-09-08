import { NextResponse } from 'next/server';
import { z } from 'zod';

import { withErrorHandling } from '@/server/http';
import { requireRole } from '@/server/auth/guards';
import { Role } from '@/server/constants';
import * as loansService from '@/server/loans/service';

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(200).default(20),
});

export const GET = withErrorHandling(async (request) => {
  await requireRole(request, Role.ADMIN, Role.MANAGER, Role.LIBRARIAN, Role.IT_HEAD);
  const url = new URL(request.url);
  const query = querySchema.parse({
    page: url.searchParams.get('page') ?? undefined,
    page_size: url.searchParams.get('page_size') ?? undefined,
  });
  const result = await loansService.listAllLoans({ page: query.page, pageSize: query.page_size });
  return NextResponse.json(result);
});
