import { NextResponse } from 'next/server';

import { withErrorHandling, readJsonBody } from '@/server/http';
import { requireRole } from '@/server/auth/guards';
import { RAISER_ROLES, STAFF_ROLES } from '@/server/supportTickets/constants';
import { supportTicketCreateSchema } from '@/server/supportTickets/schemas';
import * as supportTicketsService from '@/server/supportTickets/service';

export const POST = withErrorHandling(async (request) => {
  const user = await requireRole(request, ...RAISER_ROLES);
  const payload = supportTicketCreateSchema.parse(await readJsonBody(request));
  const ticket = await supportTicketsService.createTicket(user, payload);
  return NextResponse.json(ticket, { status: 201 });
});

export const GET = withErrorHandling(async (request) => {
  await requireRole(request, ...STAFF_ROLES);
  const url = new URL(request.url);
  const statusFilter = url.searchParams.get('status');
  const tickets = await supportTicketsService.listAllTickets(statusFilter);
  return NextResponse.json(tickets);
});
