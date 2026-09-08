import { NextResponse } from 'next/server';
import { z } from 'zod';

import { withErrorHandling } from '@/server/http';
import { requireRole } from '@/server/auth/guards';
import { Role } from '@/server/constants';
import * as adminService from '@/server/admin/service';

const querySchema = z.object({
  search: z.string().nullable().optional(),
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .nullable()
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  // Upper bound raised beyond the usual 100 so the monthly-report export can pull a
  // full month's rows in a single request instead of paging through it.
  page_size: z.coerce.number().int().min(1).max(1000).default(20),
});

export const GET = withErrorHandling(async (request) => {
  await requireRole(request, Role.ADMIN);
  const url = new URL(request.url);
  const query = querySchema.parse({
    search: url.searchParams.get('search'),
    month: url.searchParams.get('month'),
    page: url.searchParams.get('page') ?? undefined,
    page_size: url.searchParams.get('page_size') ?? undefined,
  });

  const result = await adminService.listPayments({
    search: query.search ?? null,
    page: query.page,
    pageSize: query.page_size,
    month: query.month ?? null,
  });
  return NextResponse.json(result);
});
