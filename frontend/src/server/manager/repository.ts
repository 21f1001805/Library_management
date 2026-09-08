import type { Book, Loan, Prisma, User } from '@prisma/client';

import { prisma } from '@/server/db';
import { Role } from '@/server/constants';

// Mirrors backend/src/app/modules/manager/repository.py.
export async function countSeatBookingsCreatedBetween(start: Date, end: Date): Promise<number> {
  return prisma.seatBooking.count({ where: { createdAt: { gte: start, lt: end } } });
}

export async function countLoansCreatedBetween(start: Date, end: Date): Promise<number> {
  return prisma.loan.count({ where: { createdAt: { gte: start, lt: end } } });
}

export async function countLoansReturnedBetween(start: Date, end: Date): Promise<number> {
  return prisma.loan.count({ where: { returnedAt: { gte: start, lt: end } } });
}

export async function countMembersCreatedBetween(start: Date, end: Date): Promise<number> {
  return prisma.user.count({
    where: { role: { name: Role.MEMBER }, deletedAt: null, createdAt: { gte: start, lt: end } },
  });
}

export async function countPendingReservations(): Promise<number> {
  return prisma.reservation.count({ where: { status: 'pending' } });
}

export async function countOpenSupportTickets(): Promise<number> {
  return prisma.supportTicket.count({ where: { status: 'open' } });
}

export async function listBooks(opts: {
  search: string | null;
  page: number;
  pageSize: number;
}): Promise<[Book[], number]> {
  const where: Prisma.BookWhereInput = { deletedAt: null };
  if (opts.search) {
    where.OR = [
      { title: { contains: opts.search, mode: 'insensitive' } },
      { author: { contains: opts.search, mode: 'insensitive' } },
    ];
  }

  const total = await prisma.book.count({ where });
  const items = await prisma.book.findMany({
    where,
    orderBy: { title: 'asc' },
    skip: (opts.page - 1) * opts.pageSize,
    take: opts.pageSize,
  });
  return [items, total];
}

// Pre-sorted by dueDate ascending so the first match per book is the soonest a copy is
// expected back.
export async function listActiveLoansForBooks(bookIds: string[]): Promise<Loan[]> {
  if (bookIds.length === 0) return [];
  return prisma.loan.findMany({
    where: { bookId: { in: bookIds }, returnedAt: null },
    orderBy: { dueDate: 'asc' },
  });
}

// One bulk fetch feeding three dashboard charts (most-borrowed books, member activity,
// overdue/fines) — each buckets a different subset/field of the same rows.
export async function listLoansBorrowedSince(start: Date) {
  return prisma.loan.findMany({ where: { borrowedAt: { gte: start } }, include: { book: true } });
}

export async function listMembersCreatedSince(start: Date): Promise<User[]> {
  return prisma.user.findMany({
    where: { role: { name: Role.MEMBER }, deletedAt: null, createdAt: { gte: start } },
  });
}

// ── AI insight cards (manager/insights.ts) ───────────────────────────────────
// Grouped counts, not per-loan/per-reservation rows — aggregating in SQL avoids
// hydrating the underlying rows just to count them in JS.

// bookId -> [loans borrowed in [recentStart, now], loans borrowed in [priorStart, recentStart))
export async function countLoansByBookInWindows(
  recentStart: Date,
  priorStart: Date,
): Promise<Map<string, [number, number]>> {
  const rows = await prisma.$queryRaw<{ book_id: string; recent: number; prior: number }[]>`
    SELECT book_id::text AS book_id,
           COUNT(*) FILTER (WHERE borrowed_at >= ${recentStart}::timestamptz)::int AS recent,
           COUNT(*) FILTER (
             WHERE borrowed_at >= ${priorStart}::timestamptz AND borrowed_at < ${recentStart}::timestamptz
           )::int AS prior
    FROM loans
    WHERE borrowed_at >= ${priorStart}::timestamptz
    GROUP BY book_id`;
  return new Map(rows.map((row) => [row.book_id, [row.recent, row.prior]]));
}

// bookId -> [reservations created in [recentStart, now], in [priorStart, recentStart))
// — any status, since even a since-cancelled request still reflects real demand at the
// moment it was made.
export async function countReservationsByBookInWindows(
  recentStart: Date,
  priorStart: Date,
): Promise<Map<string, [number, number]>> {
  const rows = await prisma.$queryRaw<{ book_id: string; recent: number; prior: number }[]>`
    SELECT book_id::text AS book_id,
           COUNT(*) FILTER (WHERE created_at >= ${recentStart}::timestamptz)::int AS recent,
           COUNT(*) FILTER (
             WHERE created_at >= ${priorStart}::timestamptz AND created_at < ${recentStart}::timestamptz
           )::int AS prior
    FROM reservations
    WHERE created_at >= ${priorStart}::timestamptz
    GROUP BY book_id`;
  return new Map(rows.map((row) => [row.book_id, [row.recent, row.prior]]));
}

// memberId -> [lateReturns, totalReturns], across every loan they've ever returned.
export async function memberLateReturnHistory(): Promise<Map<string, [number, number]>> {
  const rows = await prisma.$queryRaw<{ member_id: string; late: number; total: number }[]>`
    SELECT member_id::text AS member_id,
           COUNT(*) FILTER (WHERE returned_at::date > due_date::date)::int AS late,
           COUNT(*)::int AS total
    FROM loans
    WHERE returned_at IS NOT NULL
    GROUP BY member_id`;
  return new Map(rows.map((row) => [row.member_id, [row.late, row.total]]));
}
