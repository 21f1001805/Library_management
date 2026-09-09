import { prisma } from '@/server/db';
import { Role } from '@/server/constants';

// Mirrors backend/scripts/seed_visits.py. Seeds demo library-visit data: 8 members
// currently checked in, plus up to 30 historical (already checked-out) visits from the
// past 7 days. Idempotent — skips entirely if any active visit already exists. Uses
// plain unseeded randomness, same as the Python original (no fixed seed there either).

function randint(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function shuffle<T>(items: T[]): void {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
}

export async function seedVisits(): Promise<string> {
  const existing = await prisma.libraryVisit.count({ where: { checkedOutAt: null } });
  if (existing > 0) {
    const line = `visits already seeded (${existing} active), skipping`;
    console.log(line);
    return line;
  }

  const staff = await prisma.user.findFirst({
    where: { role: { name: { in: [Role.MANAGER, Role.LIBRARIAN, Role.ADMIN] } } },
  });
  if (!staff) {
    const line = 'no staff found, skipping visit seed';
    console.log(line);
    return line;
  }

  const members = await prisma.user.findMany({
    where: { role: { name: Role.MEMBER }, isActive: true },
    take: 40,
    orderBy: { createdAt: 'asc' },
  });
  if (members.length === 0) {
    const line = 'no members found, skipping visit seed';
    console.log(line);
    return line;
  }

  shuffle(members);
  const now = new Date();

  // Currently checked in (8 members, checked in 15-90 mins ago, staggered).
  const currentlyIn = members.slice(0, 8);
  for (let i = 0; i < currentlyIn.length; i++) {
    const checkedInAt = new Date(now.getTime() - (15 + i * 10) * 60_000);
    await prisma.libraryVisit.create({
      data: { memberId: currentlyIn[i].id, recordedById: staff.id, checkedInAt },
    });
  }

  // Historical visits over the past 7 days (already checked out).
  const historicalMembers = members.length >= 38 ? members.slice(8, 38) : members.slice(8);
  for (const member of historicalMembers) {
    const daysAgo = randint(0, 6);
    const checkedInAt = new Date(
      now.getTime() - daysAgo * 86_400_000 - randint(1, 4) * 3_600_000 - randint(0, 59) * 60_000,
    );
    const durationMinutes = randint(30, 180);
    let checkedOutAt = new Date(checkedInAt.getTime() + durationMinutes * 60_000);
    // Don't create a future checkout.
    if (checkedOutAt > now) checkedOutAt = new Date(now.getTime() - 5 * 60_000);
    await prisma.libraryVisit.create({
      data: { memberId: member.id, recordedById: staff.id, checkedInAt, checkedOutAt },
    });
  }

  const activeCount = await prisma.libraryVisit.count({ where: { checkedOutAt: null } });
  const totalCount = await prisma.libraryVisit.count();
  const line = `seeded ${totalCount} visits (${activeCount} currently active)`;
  console.log(line);
  return line;
}
