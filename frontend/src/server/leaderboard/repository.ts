import type { User } from '@prisma/client';

import { prisma } from '@/server/db';
import { Role } from '@/server/constants';

// Mirrors backend/src/app/modules/leaderboard/repository.py. A streak only needs
// enough history to walk back from today — loading every login row ever recorded was
// the single most expensive query on this page.
const STREAK_WINDOW_DAYS = 400;

export async function listMemberUsers(): Promise<User[]> {
  return prisma.user.findMany({ where: { role: { name: Role.MEMBER }, deletedAt: null } });
}

export async function countCompletedProgressByMember(): Promise<Map<string, number>> {
  const rows = await prisma.$queryRaw<{ member_id: string; count: bigint }[]>`
    SELECT rp.member_id::text AS member_id, COUNT(*)::bigint AS count
    FROM reading_progress rp
    JOIN users u ON u.id = rp.member_id
    JOIN roles r ON r.id = u.role_id
    WHERE rp.status = 'completed' AND r.name = ${Role.MEMBER}
    GROUP BY 1`;
  return new Map(rows.map((row) => [row.member_id, Number(row.count)]));
}

export async function countReviewsByMember(): Promise<Map<string, number>> {
  const rows = await prisma.$queryRaw<{ member_id: string; count: bigint }[]>`
    SELECT rv.member_id::text AS member_id, COUNT(*)::bigint AS count
    FROM reviews rv
    JOIN users u ON u.id = rv.member_id
    JOIN roles r ON r.id = u.role_id
    WHERE r.name = ${Role.MEMBER}
    GROUP BY 1`;
  return new Map(rows.map((row) => [row.member_id, Number(row.count)]));
}

export async function countAttendedEventsByMember(): Promise<Map<string, number>> {
  const rows = await prisma.$queryRaw<{ member_id: string; count: bigint }[]>`
    SELECT er.member_id::text AS member_id, COUNT(*)::bigint AS count
    FROM event_registrations er
    JOIN users u ON u.id = er.member_id
    JOIN roles r ON r.id = u.role_id
    JOIN events e ON e.id = er.event_id
    WHERE r.name = ${Role.MEMBER} AND e.deleted_at IS NULL AND e.date <= NOW()
    GROUP BY 1`;
  return new Map(rows.map((row) => [row.member_id, Number(row.count)]));
}

// On-time and late return counts per member, split in SQL.
export async function countReturnsByMember(): Promise<[Map<string, number>, Map<string, number>]> {
  const rows = await prisma.$queryRaw<{ member_id: string; on_time: bigint; late: bigint }[]>`
    SELECT l.member_id::text AS member_id,
           COUNT(*) FILTER (WHERE l.returned_at <= l.due_date)::bigint AS on_time,
           COUNT(*) FILTER (WHERE l.returned_at >  l.due_date)::bigint AS late
    FROM loans l
    JOIN users u ON u.id = l.member_id
    JOIN roles r ON r.id = u.role_id
    WHERE l.returned_at IS NOT NULL AND r.name = ${Role.MEMBER}
    GROUP BY 1`;
  const onTime = new Map(rows.map((row) => [row.member_id, Number(row.on_time)]));
  const late = new Map(rows.map((row) => [row.member_id, Number(row.late)]));
  return [onTime, late];
}

// Login dates per member, limited to the streak window.
export async function listRecentLoginDates(): Promise<Map<string, Set<string>>> {
  const cutoff = new Date(Date.now() - STREAK_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const rows = await prisma.$queryRaw<{ member_id: string; date: Date }[]>`
    SELECT la.member_id::text AS member_id, la.date
    FROM login_activity la
    JOIN users u ON u.id = la.member_id
    JOIN roles r ON r.id = u.role_id
    WHERE r.name = ${Role.MEMBER} AND la.date >= (${cutoff}::timestamptz AT TIME ZONE 'UTC')`;
  const dates = new Map<string, Set<string>>();
  for (const row of rows) {
    const key = row.date.toISOString().slice(0, 10);
    const set = dates.get(row.member_id) ?? new Set<string>();
    set.add(key);
    dates.set(row.member_id, set);
  }
  return dates;
}
