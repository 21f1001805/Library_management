import { NextResponse } from 'next/server';
import { z } from 'zod';

import { withErrorHandling } from '@/server/http';
import { requireRole } from '@/server/auth/guards';
import { Role } from '@/server/constants';
import * as managerService from '@/server/manager/service';

const querySchema = z.object({
  search: z.string().nullable().optional(),
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20),
});

export const GET = withErrorHandling(async (request) => {
  await requireRole(request, Role.MANAGER, Role.LIBRARIAN);
  const url = new URL(request.url);
  const query = querySchema.parse({
    search: url.searchParams.get('search'),
    page: url.searchParams.get('page') ?? undefined,
    page_size: url.searchParams.get('page_size') ?? undefined,
  });
  const result = await managerService.listBookAvailability({
    search: query.search ?? null,
    page: query.page,
    pageSize: query.page_size,
  });
  return NextResponse.json(result);
});
