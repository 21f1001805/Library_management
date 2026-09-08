import type { Prisma } from '@prisma/client';

import { prisma } from '@/server/db';
import { Role } from '@/server/constants';

// Mirrors backend/src/app/modules/events/repository.py.
const INCLUDE = {
  registrations: { include: { member: true } },
  managerAssignments: { include: { manager: true } },
} satisfies Prisma.EventInclude;
export type EventWithRelations = Prisma.EventGetPayload<{ include: typeof INCLUDE }>;

const ANALYTICS_INCLUDE = {
  registrations: { include: { member: { include: { role: true } } } },
} satisfies Prisma.EventInclude;
export type EventWithAnalyticsRelations = Prisma.EventGetPayload<{ include: typeof ANALYTICS_INCLUDE }>;

// List events, optionally restricted to upcoming or past ones. The timeframe filter has
// to happen here, not in the caller — ordering is by date ascending across every event,
// so filtering a page client-side means filtering the *oldest* events.
export async function listEvents(opts: {
  skip: number;
  take: number;
  timeframe: 'all' | 'upcoming' | 'past';
}): Promise<[EventWithRelations[], number]> {
  const where: Prisma.EventWhereInput = { deletedAt: null };
  const now = new Date();
  if (opts.timeframe === 'upcoming') where.date = { gte: now };
  else if (opts.timeframe === 'past') where.date = { lt: now };

  // Not routed through the shared paginate() helper — Prisma's generic delegate method
  // types don't structurally unify with that helper's simplified signature once
  // `include` is involved (same issue as loans.listAll and admin's member listing).
  const total = await prisma.event.count({ where });
  const items = await prisma.event.findMany({
    where,
    include: INCLUDE,
    // Upcoming reads soonest-first; past reads most-recent-first.
    orderBy: { date: opts.timeframe === 'past' ? 'desc' : 'asc' },
    skip: opts.skip,
    take: opts.take,
  });
  return [items, total];
}

export async function findById(eventId: string): Promise<EventWithRelations | null> {
  return prisma.event.findUnique({ where: { id: eventId }, include: INCLUDE });
}

export async function findByIdForAnalytics(eventId: string): Promise<EventWithAnalyticsRelations | null> {
  return prisma.event.findUnique({ where: { id: eventId }, include: ANALYTICS_INCLUDE });
}

export async function createEvent(data: Prisma.EventCreateInput): Promise<EventWithRelations> {
  return prisma.event.create({ data, include: INCLUDE });
}

// Update under the same lock used by registration capacity checks.
export async function updateEventWithCapacityGuard(
  eventId: string,
  data: Prisma.EventUpdateInput,
): Promise<[EventWithRelations | null, 'not_found' | 'capacity' | null]> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${eventId}))`;
    const event = await tx.event.findUnique({ where: { id: eventId }, include: INCLUDE });
    if (!event || event.deletedAt !== null) return [null, 'not_found'] as const;

    const requestedCapacity = (data.capacity as number | undefined) ?? null;
    if (requestedCapacity !== null) {
      const registrations = event.registrations.length;
      if (requestedCapacity < registrations) return [event, 'capacity'] as const;
    }
    const updated = await tx.event.update({ where: { id: eventId }, data, include: INCLUDE });
    return [updated, null] as const;
  });
}

export async function softDeleteEvent(eventId: string): Promise<void> {
  await prisma.event.update({ where: { id: eventId }, data: { deletedAt: new Date() } });
}

export async function findRegistration(eventId: string, memberId: string) {
  return prisma.eventRegistration.findUnique({
    where: { eventId_memberId: { eventId, memberId } },
  });
}

// Atomically registers a member, returning an error code when rejected.
export async function createRegistrationIfSpace(
  eventId: string,
  memberId: string,
): Promise<[EventWithRelations | null, 'not_found' | 'duplicate' | 'capacity' | null]> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${eventId}))`;
    const event = await tx.event.findUnique({ where: { id: eventId }, include: INCLUDE });
    if (!event || event.deletedAt !== null) return [null, 'not_found'] as const;
    if (event.registrations.some((row) => row.memberId === memberId)) {
      return [event, 'duplicate'] as const;
    }
    if (event.registrations.length >= event.capacity) return [event, 'capacity'] as const;
    await tx.eventRegistration.create({ data: { eventId, memberId } });
    const updated = await tx.event.findUnique({ where: { id: eventId }, include: INCLUDE });
    return [updated, null] as const;
  });
}

export async function deleteRegistration(eventId: string, memberId: string): Promise<void> {
  await prisma.eventRegistration.delete({ where: { eventId_memberId: { eventId, memberId } } });
}

export async function countEventsThisMonth(): Promise<number> {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return prisma.event.count({ where: { deletedAt: null, date: { gte: start } } });
}

export async function countTotalRegistrations(): Promise<number> {
  return prisma.eventRegistration.count();
}

// Total seats across every live event, aggregated in SQL rather than in JS.
export async function sumCapacity(): Promise<number> {
  const rows = await prisma.$queryRaw<{ total: bigint }[]>`
    SELECT COALESCE(SUM(capacity), 0)::bigint AS total FROM events WHERE deleted_at IS NULL`;
  return rows.length > 0 ? Number(rows[0].total) : 0;
}

export async function listManagerIds(candidateIds: string[]): Promise<string[]> {
  if (candidateIds.length === 0) return [];
  const rows = await prisma.user.findMany({
    where: {
      id: { in: candidateIds },
      isActive: true,
      deletedAt: null,
      role: { name: Role.MANAGER },
    },
  });
  return rows.map((row) => row.id);
}

export async function setManagerAssignments(eventId: string, managerIds: string[]): Promise<void> {
  await prisma.eventManagerAssignment.deleteMany({ where: { eventId } });
  for (const managerId of managerIds) {
    await prisma.eventManagerAssignment.create({ data: { eventId, managerId } });
  }
}
