import type { Prisma } from '@prisma/client';

import { HttpError } from '@/server/http';
import * as repository from '@/server/events/repository';
import type { EventWithRelations } from '@/server/events/repository';
import {
  eventToJson,
  type AttendanceSummary,
  type EventAnalytics,
  type EventAnalyticsRegistrant,
  type EventCreateInput,
  type EventListResponse,
  type EventOut,
  type EventUpdateInput,
  type RoleBreakdown,
} from '@/server/events/schemas';

// Mirrors backend/src/app/modules/events/service.py.
export async function listEvents(opts: {
  page: number;
  pageSize: number;
  memberId: string | null;
  timeframe: 'all' | 'upcoming' | 'past';
}): Promise<EventListResponse> {
  const [items, total] = await repository.listEvents({
    skip: (opts.page - 1) * opts.pageSize,
    take: opts.pageSize,
    timeframe: opts.timeframe,
  });
  return { items: items.map((e) => eventToJson(e, opts.memberId)), total };
}

export async function getEvent(eventId: string, memberId: string | null): Promise<EventOut> {
  const event = await repository.findById(eventId);
  if (!event || event.deletedAt !== null) throw new HttpError(404, 'Event not found');
  return eventToJson(event, memberId);
}

export async function createEvent(payload: EventCreateInput, creatorId: string): Promise<EventOut> {
  let managerIds: string[] = [];
  if (payload.manager_ids.length > 0) {
    managerIds = await repository.listManagerIds(payload.manager_ids);
    if (!sameSet(managerIds, payload.manager_ids)) {
      throw new HttpError(422, 'Every assigned manager must be an active manager account');
    }
  }

  let event = await repository.createEvent({
    title: payload.title,
    description: payload.description ?? null,
    location: payload.location,
    date: payload.date,
    capacity: payload.capacity,
    creator: { connect: { id: creatorId } },
  });

  if (managerIds.length > 0) {
    await repository.setManagerAssignments(event.id, managerIds);
    const refetched = await repository.findById(event.id);
    if (refetched) event = refetched;
  }

  return eventToJson(event, creatorId);
}

export async function updateEvent(eventId: string, payload: EventUpdateInput): Promise<EventOut> {
  const event = await repository.findById(eventId);
  if (!event || event.deletedAt !== null) throw new HttpError(404, 'Event not found');

  const data: Prisma.EventUpdateInput = {};
  if (payload.title !== undefined && payload.title !== null) data.title = payload.title;
  if ('description' in payload) data.description = payload.description;
  if (payload.location !== undefined && payload.location !== null) data.location = payload.location;
  if (payload.date !== undefined && payload.date !== null) data.date = payload.date;
  if (payload.capacity !== undefined && payload.capacity !== null) data.capacity = payload.capacity;

  let updated: EventWithRelations = event;
  if (Object.keys(data).length > 0) {
    const [result, error] = await repository.updateEventWithCapacityGuard(eventId, data);
    if (error === 'not_found' || !result) throw new HttpError(404, 'Event not found');
    if (error === 'capacity') {
      throw new HttpError(409, 'Capacity cannot be lower than the current registration count');
    }
    updated = result;
  }

  if (payload.manager_ids != null) {
    const managerIds = await repository.listManagerIds(payload.manager_ids);
    if (!sameSet(managerIds, payload.manager_ids)) {
      throw new HttpError(422, 'Every assigned manager must be an active manager account');
    }
    await repository.setManagerAssignments(eventId, managerIds);
    const refetched = await repository.findById(eventId);
    if (refetched) updated = refetched;
  }

  return eventToJson(updated);
}

export async function deleteEvent(eventId: string): Promise<void> {
  const event = await repository.findById(eventId);
  if (!event || event.deletedAt !== null) throw new HttpError(404, 'Event not found');
  await repository.softDeleteEvent(eventId);
}

export async function register(eventId: string, memberId: string): Promise<EventOut> {
  const [event, error] = await repository.createRegistrationIfSpace(eventId, memberId);
  if (error === 'not_found' || !event) throw new HttpError(404, 'Event not found');
  if (error === 'capacity') throw new HttpError(409, 'Event is at capacity');
  if (error === 'duplicate') throw new HttpError(409, 'Already registered');
  return eventToJson(event, memberId);
}

export async function unregister(
  eventId: string,
  memberId: string,
  viewerId?: string,
): Promise<EventOut> {
  const event = await repository.findById(eventId);
  if (!event || event.deletedAt !== null) throw new HttpError(404, 'Event not found');

  const existing = await repository.findRegistration(eventId, memberId);
  if (!existing) throw new HttpError(404, 'Not registered');

  await repository.deleteRegistration(eventId, memberId);
  const updated = await repository.findById(eventId);
  if (!updated) throw new HttpError(404, 'Event not found');
  // viewerId lets staff remove someone else's registration without the response's
  // `registered` flag flipping to reflect the removed member instead of themselves.
  return eventToJson(updated, viewerId ?? memberId);
}

export async function getEventAnalytics(eventId: string): Promise<EventAnalytics> {
  const event = await repository.findByIdForAnalytics(eventId);
  if (!event || event.deletedAt !== null) throw new HttpError(404, 'Event not found');

  if (event.date > new Date()) {
    throw new HttpError(400, 'Analytics are available once the event has taken place');
  }

  const registrations = [...(event.registrations ?? [])].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );

  const roleCounts = new Map<string, number>();
  const registrants: EventAnalyticsRegistrant[] = [];
  for (const r of registrations) {
    const roleName = r.member.role?.name ?? 'unknown';
    roleCounts.set(roleName, (roleCounts.get(roleName) ?? 0) + 1);
    registrants.push({
      id: r.member.id,
      full_name: r.member.fullName,
      email: r.member.email,
      role: roleName,
      registered_at: r.createdAt.toISOString(),
    });
  }

  const totalRegistered = registrants.length;
  const fillRate = event.capacity > 0 ? totalRegistered / event.capacity : 0.0;

  const registrantsByRole: RoleBreakdown[] = [...roleCounts.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([role, count]) => ({ role, count }));

  return {
    event_id: event.id,
    title: event.title,
    date: event.date.toISOString(),
    location: event.location,
    capacity: event.capacity,
    total_registered: totalRegistered,
    fill_rate: Math.round(fillRate * 100) / 100,
    registrants_by_role: registrantsByRole,
    registrants,
  };
}

export async function getAttendanceSummary(): Promise<AttendanceSummary> {
  const eventsThisMonth = await repository.countEventsThisMonth();
  const totalRegistrations = await repository.countTotalRegistrations();
  // Summing capacity over a bounded page while counting *every* registration made the
  // ratio climb past 100% once the library passed many events. Both sides of the
  // fraction now cover the same set.
  const totalCapacity = await repository.sumCapacity();
  const avgRate = totalCapacity > 0 ? totalRegistrations / totalCapacity : 0.0;
  return {
    total_events_this_month: eventsThisMonth,
    total_attendees: totalRegistrations,
    average_attendance_rate: Math.round(avgRate * 100) / 100,
  };
}

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const setA = new Set(a);
  return b.every((item) => setA.has(item));
}
