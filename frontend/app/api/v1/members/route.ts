import { NextResponse } from 'next/server';
import { z } from 'zod';

import { withErrorHandling, readJsonBody } from '@/server/http';
import { requireRole } from '@/server/auth/guards';
import { Role } from '@/server/constants';
import { memberCreateSchema } from '@/server/members/schemas';
import * as membersService from '@/server/members/service';

// Mirrors backend/src/app/modules/members/router.py.

const listQuerySchema = z.object({
  search: z.string().nullable().optional(),
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20),
  role: z.string().nullable().optional(),
  active_only: z.coerce.boolean().default(false),
});

export const GET = withErrorHandling(async (request) => {
  await requireRole(request, Role.ADMIN, Role.LIBRARIAN, Role.MANAGER, Role.IT_HEAD);
  const url = new URL(request.url);
  const query = listQuerySchema.parse({
    search: url.searchParams.get('search'),
    page: url.searchParams.get('page') ?? undefined,
    page_size: url.searchParams.get('page_size') ?? undefined,
    role: url.searchParams.get('role'),
    active_only: url.searchParams.get('active_only') ?? undefined,
  });
  const result = await membersService.listMembers({
    search: query.search ?? null,
    page: query.page,
    pageSize: query.page_size,
    role: query.role ?? null,
    activeOnly: query.active_only,
  });
  return NextResponse.json(result);
});

export const POST = withErrorHandling(async (request) => {
  await requireRole(request, Role.ADMIN);
  const payload = memberCreateSchema.parse(await readJsonBody(request));
  const member = await membersService.createMember(payload);
  return NextResponse.json(member, { status: 201 });
});
