import { NextResponse } from 'next/server';
import { z } from 'zod';

import { withErrorHandling } from '@/server/http';
import { requireRole } from '@/server/auth/guards';
import { Role } from '@/server/constants';
import * as adminService from '@/server/admin/service';

const querySchema = z.object({
  search: z.string().nullable().optional(),
  role: z.string().nullable().optional(),
  status: z.enum(['active', 'inactive']).nullable().optional(),
  sort_by: z.enum(['name', 'joined', 'role']).default('joined'),
  sort_dir: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20),
});

export const GET = withErrorHandling(async (request) => {
  await requireRole(request, Role.ADMIN);
  const url = new URL(request.url);
  const query = querySchema.parse({
    search: url.searchParams.get('search'),
    role: url.searchParams.get('role'),
    status: url.searchParams.get('status'),
    sort_by: url.searchParams.get('sort_by') ?? undefined,
    sort_dir: url.searchParams.get('sort_dir') ?? undefined,
    page: url.searchParams.get('page') ?? undefined,
    page_size: url.searchParams.get('page_size') ?? undefined,
  });

  const result = await adminService.listMembers({
    search: query.search ?? null,
    page: query.page,
    pageSize: query.page_size,
    role: query.role ?? null,
    status: query.status ?? null,
    sortBy: query.sort_by,
    sortDir: query.sort_dir,
  });
  return NextResponse.json(result);
});
