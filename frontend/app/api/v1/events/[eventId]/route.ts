import { NextResponse } from 'next/server';

import { withErrorHandling, readJsonBody } from '@/server/http';
import { getOptionalUser, requireRole } from '@/server/auth/guards';
import { Role } from '@/server/constants';
import { eventUpdateSchema } from '@/server/events/schemas';
import * as eventsService from '@/server/events/service';

export const GET = withErrorHandling(async (request, { params }) => {
  const user = await getOptionalUser(request);
  const { eventId } = await params;
  const event = await eventsService.getEvent(eventId as string, user?.id ?? null);
  return NextResponse.json(event);
});

export const PUT = withErrorHandling(async (request, { params }) => {
  await requireRole(request, Role.ADMIN, Role.MANAGER, Role.LIBRARIAN);
  const { eventId } = await params;
  const payload = eventUpdateSchema.parse(await readJsonBody(request));
  const event = await eventsService.updateEvent(eventId as string, payload);
  return NextResponse.json(event);
});

export const DELETE = withErrorHandling(async (request, { params }) => {
  await requireRole(request, Role.ADMIN, Role.MANAGER, Role.LIBRARIAN);
  const { eventId } = await params;
  await eventsService.deleteEvent(eventId as string);
  return new NextResponse(null, { status: 204 });
});
