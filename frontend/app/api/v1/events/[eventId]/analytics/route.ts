import { NextResponse } from 'next/server';

import { withErrorHandling } from '@/server/http';
import { requireRole } from '@/server/auth/guards';
import { Role } from '@/server/constants';
import * as eventsService from '@/server/events/service';

export const GET = withErrorHandling(async (request, { params }) => {
  await requireRole(request, Role.ADMIN);
  const { eventId } = await params;
  const analytics = await eventsService.getEventAnalytics(eventId as string);
  return NextResponse.json(analytics);
});
