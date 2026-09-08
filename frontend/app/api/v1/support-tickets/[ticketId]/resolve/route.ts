import { NextResponse } from 'next/server';

import { withErrorHandling, readJsonBody } from '@/server/http';
import { requireRole } from '@/server/auth/guards';
import { STAFF_ROLES } from '@/server/supportTickets/constants';
import { supportTicketResolveSchema } from '@/server/supportTickets/schemas';
import * as supportTicketsService from '@/server/supportTickets/service';

export const POST = withErrorHandling(async (request, { params }) => {
  const user = await requireRole(request, ...STAFF_ROLES);
  const { ticketId } = await params;
  const payload = supportTicketResolveSchema.parse(await readJsonBody(request));
  const ticket = await supportTicketsService.resolveTicket(ticketId as string, user, payload);
  return NextResponse.json(ticket);
});
