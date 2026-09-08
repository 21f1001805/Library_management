import { NextResponse } from 'next/server';

import { withErrorHandling } from '@/server/http';
import { getCurrentUser } from '@/server/auth/guards';
import * as eventsService from '@/server/events/service';

export const POST = withErrorHandling(async (request, { params }) => {
  const user = await getCurrentUser(request);
  const { eventId } = await params;
  const event = await eventsService.register(eventId as string, user.id);
  return NextResponse.json(event);
});

export const DELETE = withErrorHandling(async (request, { params }) => {
  const user = await getCurrentUser(request);
  const { eventId } = await params;
  const event = await eventsService.unregister(eventId as string, user.id);
  return NextResponse.json(event);
});
