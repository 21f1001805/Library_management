import type { GuardianLink, Prisma, User } from '@prisma/client';

import { prisma } from '@/server/db';

// Mirrors backend/src/app/modules/guardian/repository.py.
const CHILD_INCLUDE = { role: true } satisfies Prisma.UserInclude;
export type Child = Prisma.UserGetPayload<{ include: typeof CHILD_INCLUDE }>;

export async function createLink(opts: { guardianId: string; memberId: string }): Promise<GuardianLink> {
  return prisma.guardianLink.create({ data: { guardianId: opts.guardianId, memberId: opts.memberId } });
}

// Points this member's single link at `guardianId`, creating it if absent. memberId is
// unique, so one upsert covers both "link" and "change guardian" without a
// delete-then-create window that could leave the member with no guardian if the second
// step failed. lastDigestSentAt is deliberately reset: a new guardian hasn't been sent
// this month's digest yet.
export async function upsertLink(opts: { guardianId: string; memberId: string }): Promise<GuardianLink> {
  return prisma.guardianLink.upsert({
    where: { memberId: opts.memberId },
    create: { guardianId: opts.guardianId, memberId: opts.memberId },
    update: { guardianId: opts.guardianId, lastDigestSentAt: null },
  });
}

// Returns how many links were removed (0 when the member had no guardian).
export async function deleteLinkForMember(memberId: string): Promise<number> {
  const result = await prisma.guardianLink.deleteMany({ where: { memberId } });
  return result.count;
}

export async function listChildren(guardianId: string): Promise<Child[]> {
  const links = await prisma.guardianLink.findMany({
    where: { guardianId },
    include: { member: { include: CHILD_INCLUDE } },
  });
  return links.map((link) => link.member);
}

export async function findGuardianForChild(memberId: string): Promise<User | null> {
  const link = await findLinkForMember(memberId);
  return link?.guardian ?? null;
}

// The link row itself (guardian hydrated) — callers that need createdAt, not just who.
export async function findLinkForMember(memberId: string) {
  return prisma.guardianLink.findFirst({
    where: { memberId },
    include: { guardian: { include: { role: true } } },
  });
}

// Every guardian-child pair, for the monthly digest sweep — small table, no pagination
// needed at this scale.
export async function listAllLinks() {
  return prisma.guardianLink.findMany({ include: { guardian: true, member: true } });
}

export async function markDigestSent(linkId: string): Promise<void> {
  await prisma.guardianLink.update({ where: { id: linkId }, data: { lastDigestSentAt: new Date() } });
}

// (count, most-common book category) among books marked completed in [start, end).
export async function countCompletedInRange(
  memberId: string,
  start: Date,
  end: Date,
): Promise<[number, string | null]> {
  const rows = await prisma.readingProgress.findMany({
    where: { memberId, status: 'completed', updatedAt: { gte: start, lt: end } },
    include: { book: true },
  });
  if (rows.length === 0) return [0, null];

  const counts = new Map<string, number>();
  for (const row of rows) {
    if (!row.book) continue;
    counts.set(row.book.category, (counts.get(row.book.category) ?? 0) + 1);
  }
  let topCategory: string | null = null;
  let topCount = -1;
  for (const [category, count] of counts) {
    if (count > topCount) {
      topCategory = category;
      topCount = count;
    }
  }
  return [rows.length, topCategory];
}
