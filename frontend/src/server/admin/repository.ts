import { Prisma, type Expense, type Payment } from '@prisma/client';

import { prisma } from '@/server/db';
import { Role } from '@/server/constants';

// Mirrors backend/src/app/modules/admin/repository.py.

export async function sumPayments(opts: {
  start: Date;
  end?: Date;
  hasPlan?: boolean;
}): Promise<number> {
  const where: Prisma.PaymentWhereInput = {
    status: 'success',
    createdAt: opts.end ? { gte: opts.start, lt: opts.end } : { gte: opts.start },
  };
  if (opts.hasPlan === true) where.planMonths = { not: null };
  else if (opts.hasPlan === false) where.planMonths = null;

  const payments = await prisma.payment.findMany({ where });
  return payments.reduce((sum, payment) => sum + payment.amount, 0);
}

export async function sumExpenses(opts: {
  start: Date;
  end?: Date;
  category?: string;
}): Promise<number> {
  const where: Prisma.ExpenseWhereInput = {
    createdAt: opts.end ? { gte: opts.start, lt: opts.end } : { gte: opts.start },
  };
  if (opts.category !== undefined) where.category = opts.category;

  const expenses = await prisma.expense.findMany({ where });
  return expenses.reduce((sum, expense) => sum + expense.amount, 0);
}

export async function countMembers(createdBefore?: Date): Promise<number> {
  const where: Prisma.UserWhereInput = { role: { name: Role.MEMBER }, deletedAt: null };
  if (createdBefore) where.createdAt = { lt: createdBefore };
  return prisma.user.count({ where });
}

export async function createExpense(opts: {
  category: string;
  amount: number;
  loggedById: string;
}): Promise<Expense> {
  return prisma.expense.create({
    data: { category: opts.category, amount: opts.amount, loggedById: opts.loggedById },
  });
}

export async function countSeatBookings(date: Date, hour: number): Promise<number> {
  return prisma.seatBooking.count({ where: { date, hour } });
}

// The dashboard needs one figure per opening hour — fetch the day once and bucket it
// here instead of one round trip per hour.
export async function countSeatBookingsByHour(date: Date): Promise<Map<number, number>> {
  const bookings = await prisma.seatBooking.findMany({ where: { date } });
  const counts = new Map<number, number>();
  for (const booking of bookings) counts.set(booking.hour, (counts.get(booking.hour) ?? 0) + 1);
  return counts;
}

// One scan of the month's expenses, bucketed by category, rather than one filtered scan
// per category.
export async function sumExpensesByCategory(start: Date): Promise<Map<string, number>> {
  const expenses = await prisma.expense.findMany({ where: { createdAt: { gte: start } } });
  const totals = new Map<string, number>();
  for (const expense of expenses) {
    totals.set(expense.category, (totals.get(expense.category) ?? 0) + expense.amount);
  }
  return totals;
}

// Revenue and count per plan label, grouped in SQL.
export async function revenueByPlanLabel(): Promise<{ label: string; amount: bigint; count: bigint }[]> {
  return prisma.$queryRaw`
    SELECT label, SUM(amount)::bigint AS amount, COUNT(*)::bigint AS count
    FROM payments
    WHERE status = 'success' AND plan_months IS NOT NULL
    GROUP BY label
    ORDER BY amount DESC`;
}

export async function listPaymentsSince(start: Date): Promise<Payment[]> {
  return prisma.payment.findMany({ where: { status: 'success', createdAt: { gte: start } } });
}

export async function listExpenses(start: Date): Promise<Expense[]> {
  return prisma.expense.findMany({ where: { createdAt: { gte: start } } });
}

// Lifetime spend per category, grouped in SQL rather than by loading every row.
export async function expenseTotalsByCategory(): Promise<{ category: string; amount: bigint }[]> {
  return prisma.$queryRaw`
    SELECT category, SUM(amount)::bigint AS amount
    FROM expenses
    GROUP BY category
    ORDER BY amount DESC`;
}

// New members per YYYY-MM since `since`, bucketed in SQL.
export async function countMembersByMonth(since: Date): Promise<Map<string, number>> {
  const rows = await prisma.$queryRaw<{ month: string; count: bigint }[]>`
    SELECT to_char(u.created_at, 'YYYY-MM') AS month, COUNT(*)::bigint AS count
    FROM users u JOIN roles r ON r.id = u.role_id
    WHERE r.name = ${Role.MEMBER}
      AND u.deleted_at IS NULL
      AND u.created_at >= (${since}::timestamptz AT TIME ZONE 'UTC')
    GROUP BY 1`;
  return new Map(rows.map((row) => [row.month, Number(row.count)]));
}

export async function listMemberIds(): Promise<string[]> {
  const members = await prisma.user.findMany({
    where: { role: { name: Role.MEMBER }, deletedAt: null },
  });
  return members.map((member) => member.id);
}

const MEMBER_LIST_INCLUDE = { role: true } satisfies Prisma.UserInclude;
export type AdminMemberRow = Prisma.UserGetPayload<{ include: typeof MEMBER_LIST_INCLUDE }>;

export async function listMembers(opts: {
  search: string | null;
  page: number;
  pageSize: number;
  role: string | null;
  status: string | null;
  sortBy: string;
  sortDir: string;
}): Promise<[AdminMemberRow[], number]> {
  // Unlike countMembers/listMemberIds (strictly the "member" role for stats/
  // announcements), this powers the admin's account-management table, so it covers
  // every role — an admin needs to find and manage staff accounts here too.
  const where: Prisma.UserWhereInput = { deletedAt: null };
  if (opts.search) {
    where.OR = [
      { fullName: { contains: opts.search, mode: 'insensitive' } },
      { email: { contains: opts.search, mode: 'insensitive' } },
    ];
  }
  if (opts.role) where.role = { name: opts.role };
  if (opts.status === 'active') where.isActive = true;
  else if (opts.status === 'inactive') where.isActive = false;

  const direction = opts.sortDir === 'desc' ? 'desc' : 'asc';
  let orderBy: Prisma.UserOrderByWithRelationInput;
  if (opts.sortBy === 'role') orderBy = { role: { name: direction } };
  else if (opts.sortBy === 'name') orderBy = { fullName: direction };
  else orderBy = { createdAt: direction };

  const total = await prisma.user.count({ where });
  const items = await prisma.user.findMany({
    where,
    include: MEMBER_LIST_INCLUDE,
    orderBy,
    skip: (opts.page - 1) * opts.pageSize,
    take: opts.pageSize,
  });
  return [items, total];
}

const PAYMENT_LIST_INCLUDE = { user: true } satisfies Prisma.PaymentInclude;
export type AdminPaymentRow = Prisma.PaymentGetPayload<{ include: typeof PAYMENT_LIST_INCLUDE }>;

export async function listPayments(opts: {
  search: string | null;
  page: number;
  pageSize: number;
  start?: Date;
  end?: Date;
}): Promise<[AdminPaymentRow[], number]> {
  const where: Prisma.PaymentWhereInput = {};
  if (opts.search) {
    where.user = {
      is: {
        OR: [
          { fullName: { contains: opts.search, mode: 'insensitive' } },
          { email: { contains: opts.search, mode: 'insensitive' } },
        ],
      },
    };
  }
  if (opts.start !== undefined) where.createdAt = { gte: opts.start, lt: opts.end };

  const total = await prisma.payment.count({ where });
  const items = await prisma.payment.findMany({
    where,
    include: PAYMENT_LIST_INCLUDE,
    orderBy: { createdAt: 'desc' },
    skip: (opts.page - 1) * opts.pageSize,
    take: opts.pageSize,
  });
  return [items, total];
}

// Latest-row-per-user via a single ordered query, avoiding N+1s for a page of members.
export async function listLatestPayments(memberIds: string[]): Promise<Map<string, Payment>> {
  if (memberIds.length === 0) return new Map();
  const payments = await prisma.payment.findMany({
    where: { userId: { in: memberIds }, status: 'success' },
    orderBy: { createdAt: 'desc' },
  });
  const latest = new Map<string, Payment>();
  for (const payment of payments) {
    if (!latest.has(payment.userId)) latest.set(payment.userId, payment);
  }
  return latest;
}

// All successful plan payments per member, oldest first — matches the ordering
// calculateMembershipExpiry expects.
export async function listMembershipPaymentsByMember(
  memberIds: string[],
): Promise<Map<string, Payment[]>> {
  if (memberIds.length === 0) return new Map();
  const payments = await prisma.payment.findMany({
    where: { userId: { in: memberIds }, status: 'success', planMonths: { not: null } },
    orderBy: { createdAt: 'asc' },
  });
  const grouped = new Map<string, Payment[]>();
  for (const payment of payments) {
    const list = grouped.get(payment.userId) ?? [];
    list.push(payment);
    grouped.set(payment.userId, list);
  }
  return grouped;
}

export async function countReadingProgressByStatus(
  memberIds: string[],
): Promise<Map<string, { reading: number; completed: number }>> {
  if (memberIds.length === 0) return new Map();
  const rows = await prisma.readingProgress.findMany({ where: { memberId: { in: memberIds } } });
  const counts = new Map<string, { reading: number; completed: number }>();
  for (const row of rows) {
    const bucket = counts.get(row.memberId) ?? { reading: 0, completed: 0 };
    if (row.status === 'reading' || row.status === 'completed') bucket[row.status] += 1;
    counts.set(row.memberId, bucket);
  }
  return counts;
}

export async function findReportedMemberIds(memberIds: string[]): Promise<Set<string>> {
  if (memberIds.length === 0) return new Set();
  const posts = await prisma.communityPost.findMany({
    where: { authorId: { in: memberIds }, reported: true },
  });
  const comments = await prisma.communityComment.findMany({
    where: { authorId: { in: memberIds }, reported: true },
  });
  return new Set([...posts.map((p) => p.authorId), ...comments.map((c) => c.authorId)]);
}

export async function countEventRegistrations(memberIds: string[]): Promise<Map<string, number>> {
  if (memberIds.length === 0) return new Map();
  const registrations = await prisma.eventRegistration.findMany({
    where: { memberId: { in: memberIds } },
  });
  const counts = new Map<string, number>();
  for (const registration of registrations) {
    counts.set(registration.memberId, (counts.get(registration.memberId) ?? 0) + 1);
  }
  return counts;
}
