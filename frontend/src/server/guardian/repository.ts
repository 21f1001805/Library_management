import type { Prisma, User } from '@prisma/client';

import { prisma } from '@/server/db';

// Minimal subset of backend/src/app/modules/guardian/repository.py — just what
// seat_booking needs (who a member's guardian is, and a guardian's linked children).
// The rest of the guardian module (its own router, dashboard) is a later phase.
const CHILD_INCLUDE = { role: true } satisfies Prisma.UserInclude;
type Child = Prisma.UserGetPayload<{ include: typeof CHILD_INCLUDE }>;

export async function listChildren(guardianId: string): Promise<Child[]> {
  const links = await prisma.guardianLink.findMany({
    where: { guardianId },
    include: { member: { include: CHILD_INCLUDE } },
  });
  return links.map((link) => link.member);
}

export async function findLinkForMember(memberId: string) {
  return prisma.guardianLink.findFirst({
    where: { memberId },
    include: { guardian: { include: { role: true } } },
  });
}

export async function findGuardianForChild(memberId: string): Promise<User | null> {
  const link = await findLinkForMember(memberId);
  return link?.guardian ?? null;
}
