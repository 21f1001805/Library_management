import { NextResponse } from 'next/server';

import { withErrorHandling } from '@/server/http';
import { requireRole } from '@/server/auth/guards';
import { RAISER_ROLES } from '@/server/supportTickets/constants';
import * as supportTicketsService from '@/server/supportTickets/service';

export const GET = withErrorHandling(async (request) => {
  const user = await requireRole(request, ...RAISER_ROLES);
  const tickets = await supportTicketsService.listMyTickets(user);
  return NextResponse.json(tickets);
});
