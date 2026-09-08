import type { Prisma } from '@prisma/client';

import { prisma } from '@/server/db';

// Mirrors backend/src/app/modules/visits/repository.py.
const VISIT_INCLUDE = { member: true, recordedBy: true } satisfies Prisma.LibraryVisitInclude;
export type LibraryVisitWithRelations = Prisma.LibraryVisitGetPayload<{ include: typeof VISIT_INCLUDE }>;

export async function findOpenVisitForMember(memberId: string): Promise<LibraryVisitWithRelations | null> {
  return prisma.libraryVisit.findFirst({
    where: { memberId, checkedOutAt: null },
    include: VISIT_INCLUDE,
  });
}

export async function createCheckIn(
  memberId: string,
  recordedById: string,
): Promise<LibraryVisitWithRelations> {
  return prisma.libraryVisit.create({
    data: { memberId, recordedById, checkedInAt: new Date() },
    include: VISIT_INCLUDE,
  });
}

export async function closeVisit(visitId: string): Promise<LibraryVisitWithRelations> {
  return prisma.libraryVisit.update({
    where: { id: visitId },
    data: { checkedOutAt: new Date() },
    include: VISIT_INCLUDE,
  });
}

export async function listActiveVisits(): Promise<LibraryVisitWithRelations[]> {
  return prisma.libraryVisit.findMany({
    where: { checkedOutAt: null },
    orderBy: { checkedInAt: 'desc' },
    include: VISIT_INCLUDE,
  });
}

export async function getLatestVisitForMember(memberId: string): Promise<LibraryVisitWithRelations | null> {
  return prisma.libraryVisit.findFirst({
    where: { memberId },
    orderBy: { checkedInAt: 'desc' },
    include: VISIT_INCLUDE,
  });
}

// Every visit that started in [start, end) — one bulk fetch for footfall analytics to
// bucket by day/hour/duration, rather than one query per bucket.
export async function listCheckInsBetween(start: Date, end: Date) {
  return prisma.libraryVisit.findMany({
    where: { checkedInAt: { gte: start, lt: end } },
    orderBy: { checkedInAt: 'asc' },
  });
}
