import { NextResponse } from 'next/server';

import { withErrorHandling } from '@/server/http';
import { requireRole } from '@/server/auth/guards';
import { RAISER_ROLES } from '@/server/supportTickets/constants';
import * as supportTicketsService from '@/server/supportTickets/service';

export const POST = withErrorHandling(async (request, { params }) => {
  const user = await requireRole(request, ...RAISER_ROLES);
  const { ticketId } = await params;
  const ticket = await supportTicketsService.reopenTicket(ticketId as string, user);
  return NextResponse.json(ticket);
});
