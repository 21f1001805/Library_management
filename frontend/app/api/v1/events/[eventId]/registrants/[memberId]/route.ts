import { NextResponse } from 'next/server';

import { withErrorHandling } from '@/server/http';
import { requireRole } from '@/server/auth/guards';
import { Role } from '@/server/constants';
import * as eventsService from '@/server/events/service';

export const DELETE = withErrorHandling(async (request, { params }) => {
  const user = await requireRole(request, Role.ADMIN, Role.IT_HEAD);
  const { eventId, memberId } = await params;
  const event = await eventsService.unregister(eventId as string, memberId as string, user.id);
  return NextResponse.json(event);
});
