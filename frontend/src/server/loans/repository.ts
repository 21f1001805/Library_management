import { Prisma, type Loan } from '@prisma/client';

import { prisma } from '@/server/db';

// Mirrors backend/src/app/modules/loans/repository.py.
const INCLUDE = { book: true, member: true } satisfies Prisma.LoanInclude;
export type LoanWithRelations = Prisma.LoanGetPayload<{ include: typeof INCLUDE }>;

export async function create(opts: {
  bookId: string;
  memberId: string;
  dueDate: Date;
  createdById: string;
}): Promise<LoanWithRelations> {
  return prisma.loan.create({
    data: {
      bookId: opts.bookId,
      memberId: opts.memberId,
      dueDate: opts.dueDate,
      createdById: opts.createdById,
    },
    include: INCLUDE,
  });
}

// Creates a loan while holding a transaction-scoped advisory lock for its book, so the
// physical-copy capacity check and insert are atomic even when several workers approve
// loans for the same book at once.
export async function createIfAvailable(opts: {
  bookId: string;
  memberId: string;
  dueDate: Date;
  createdById: string;
  client?: Prisma.TransactionClient;
}): Promise<LoanWithRelations | null> {
  const run = async (db: Prisma.TransactionClient | typeof prisma) => {
    await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${opts.bookId}))`;
    const book = await db.book.findUnique({ where: { id: opts.bookId } });
    if (!book) return null;
    const active = await db.loan.count({ where: { bookId: opts.bookId, returnedAt: null } });
    if (active >= book.totalCopies) return null;
    return db.loan.create({
      data: {
        bookId: opts.bookId,
        memberId: opts.memberId,
        dueDate: opts.dueDate,
        createdById: opts.createdById,
      },
      include: INCLUDE,
    });
  };

  if (opts.client) return run(opts.client);
  return prisma.$transaction((tx) => run(tx));
}

export async function findById(loanId: string): Promise<LoanWithRelations | null> {
  return prisma.loan.findUnique({ where: { id: loanId }, include: INCLUDE });
}

export async function listAll(opts: {
  page: number;
  pageSize: number;
}): Promise<[LoanWithRelations[], number]> {
  // Not routed through the shared paginate() helper — Prisma's generic delegate method
  // types don't structurally unify with that helper's simplified signature once
  // `include` is involved (confirmed via build error, not just a style choice).
  const total = await prisma.loan.count({ where: {} });
  const items = await prisma.loan.findMany({
    where: {},
    orderBy: { borrowedAt: 'desc' },
    skip: (opts.page - 1) * opts.pageSize,
    take: opts.pageSize,
    include: INCLUDE,
  });
  return [items, total];
}

// A loan carries a fine when the day it came back (or today, if still out) is later than
// its due date — a column-to-column comparison Prisma's query builder can't express, so
// this drops to SQL rather than fetching a superset and discarding rows in JS.
const FINED_PREDICATE = Prisma.sql`COALESCE(l.returned_at, (NOW() AT TIME ZONE 'UTC'))::date > l.due_date::date`;

export async function sumOutstandingFineDays(): Promise<number> {
  const rows = await prisma.$queryRaw<{ days: bigint }[]>`
    SELECT COALESCE(SUM(
             COALESCE(l.returned_at, (NOW() AT TIME ZONE 'UTC'))::date - l.due_date::date
           ), 0)::bigint AS days
    FROM loans l
    WHERE l.fine_paid = false AND ${FINED_PREDICATE}`;
  return rows.length > 0 ? Number(rows[0].days) : 0;
}

export async function listFined(opts: {
  skip?: number;
  take?: number;
} = {}): Promise<LoanWithRelations[]> {
  const skip = opts.skip ?? 0;
  const rows =
    opts.take !== undefined
      ? await prisma.$queryRaw<{ id: string }[]>`
          SELECT l.id::text AS id FROM loans l WHERE ${FINED_PREDICATE}
          ORDER BY l.due_date ASC LIMIT ${opts.take} OFFSET ${skip}`
      : await prisma.$queryRaw<{ id: string }[]>`
          SELECT l.id::text AS id FROM loans l WHERE ${FINED_PREDICATE}
          ORDER BY l.due_date ASC OFFSET ${skip}`;

  const ids = rows.map((row) => row.id);
  if (ids.length === 0) return [];
  const loans = await prisma.loan.findMany({ where: { id: { in: ids } }, include: INCLUDE });
  const order = new Map(ids.map((id, index) => [id, index]));
  return loans.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

export async function listPastDue(now: Date): Promise<LoanWithRelations[]> {
  return prisma.loan.findMany({
    where: { dueDate: { lt: now } },
    include: INCLUDE,
    orderBy: { dueDate: 'asc' },
  });
}

export async function listActive(): Promise<LoanWithRelations[]> {
  return prisma.loan.findMany({
    where: { returnedAt: null },
    include: INCLUDE,
    orderBy: { dueDate: 'asc' },
  });
}

export async function listForMember(
  memberId: string,
  client?: Prisma.TransactionClient,
): Promise<LoanWithRelations[]> {
  const db = client ?? prisma;
  return db.loan.findMany({
    where: { memberId },
    include: INCLUDE,
    orderBy: { borrowedAt: 'desc' },
  });
}

export async function countActiveForBook(bookId: string): Promise<number> {
  return prisma.loan.count({ where: { bookId, returnedAt: null } });
}

export async function listActiveForBook(bookId: string): Promise<Loan[]> {
  return prisma.loan.findMany({ where: { bookId, returnedAt: null }, orderBy: { dueDate: 'asc' } });
}

export async function listActiveForBooks(bookIds: string[]): Promise<Loan[]> {
  return prisma.loan.findMany({
    where: { bookId: { in: bookIds }, returnedAt: null },
    orderBy: { dueDate: 'asc' },
  });
}

export async function markReturned(loanId: string, returnedAt: Date): Promise<LoanWithRelations> {
  return prisma.loan.update({ where: { id: loanId }, data: { returnedAt }, include: INCLUDE });
}

export async function markReminded(loanId: string, remindedAt: Date): Promise<LoanWithRelations> {
  return prisma.loan.update({
    where: { id: loanId },
    data: { lastRemindedAt: remindedAt },
    include: INCLUDE,
  });
}

// Atomically claims a reminder before any external side effect (email) is sent.
export async function claimReminder(
  loanId: string,
  opts: { remindCutoff: Date; claimedAt: Date },
): Promise<boolean> {
  const updated = await prisma.loan.updateMany({
    where: {
      id: loanId,
      returnedAt: null,
      OR: [{ lastRemindedAt: null }, { lastRemindedAt: { lte: opts.remindCutoff } }],
    },
    data: { lastRemindedAt: opts.claimedAt },
  });
  return updated.count === 1;
}

export async function markFinePaid(
  loanId: string,
  client?: Prisma.TransactionClient,
): Promise<LoanWithRelations> {
  const db = client ?? prisma;
  return db.loan.update({ where: { id: loanId }, data: { finePaid: true }, include: INCLUDE });
}

export async function markFinesPaid(
  loanIds: string[],
  client?: Prisma.TransactionClient,
): Promise<number> {
  const db = client ?? prisma;
  const result = await db.loan.updateMany({ where: { id: { in: loanIds } }, data: { finePaid: true } });
  return result.count;
}
