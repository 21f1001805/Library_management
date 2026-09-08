import { NextResponse } from 'next/server';
import { z } from 'zod';

import { withErrorHandling, readJsonBody } from '@/server/http';
import { getOptionalUser, requireRole } from '@/server/auth/guards';
import { Role } from '@/server/constants';
import { eventCreateSchema } from '@/server/events/schemas';
import * as eventsService from '@/server/events/service';

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20),
  timeframe: z.enum(['all', 'upcoming', 'past']).default('all'),
});

export const GET = withErrorHandling(async (request) => {
  const user = await getOptionalUser(request);
  const url = new URL(request.url);
  const query = querySchema.parse({
    page: url.searchParams.get('page') ?? undefined,
    page_size: url.searchParams.get('page_size') ?? undefined,
    timeframe: url.searchParams.get('timeframe') ?? undefined,
  });
  const result = await eventsService.listEvents({
    page: query.page,
    pageSize: query.page_size,
    memberId: user?.id ?? null,
    timeframe: query.timeframe,
  });
  return NextResponse.json(result);
});

export const POST = withErrorHandling(async (request) => {
  const user = await requireRole(request, Role.ADMIN, Role.MANAGER, Role.LIBRARIAN);
  const payload = eventCreateSchema.parse(await readJsonBody(request));
  const event = await eventsService.createEvent(payload, user.id);
  return NextResponse.json(event, { status: 201 });
});
