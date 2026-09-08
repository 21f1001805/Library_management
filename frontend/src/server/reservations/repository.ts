import type { Book, Prisma, Reservation } from '@prisma/client';

import { prisma } from '@/server/db';

// Mirrors backend/src/app/modules/reservations/repository.py.
const RESERVATION_INCLUDE = { book: true, loan: true } satisfies Prisma.ReservationInclude;
export type ReservationWithRelations = Prisma.ReservationGetPayload<{
  include: typeof RESERVATION_INCLUDE;
}>;
type ReservationWithMember = Prisma.ReservationGetPayload<{
  include: typeof RESERVATION_INCLUDE & { member: true };
}>;

// Display-only lists are safe to cap; list_pending_for_book(s) below are deliberately
// left uncapped since they feed queue-position math, where truncating would hand out
// wrong positions/ETAs, not just a shorter list.
const LIST_LIMIT = 200;

export async function findById(
  reservationId: string,
  client?: Prisma.TransactionClient,
): Promise<ReservationWithRelations | null> {
  const db = client ?? prisma;
  return db.reservation.findUnique({ where: { id: reservationId }, include: RESERVATION_INCLUDE });
}

// Every reservation this member has ever made, any status — used to build the AI
// reading profile's category-interest signal, where even a since-cancelled request
// still reflects a real interest at the time.
export async function listForMember(memberId: string): Promise<(Reservation & { book: Book })[]> {
  return prisma.reservation.findMany({
    where: { memberId },
    include: { book: true },
    orderBy: { createdAt: 'desc' },
  });
}

export async function listActiveForMember(memberId: string): Promise<ReservationWithRelations[]> {
  return prisma.reservation.findMany({
    where: { memberId, status: { in: ['pending', 'approved'] } },
    include: RESERVATION_INCLUDE,
    orderBy: { createdAt: 'desc' },
    take: LIST_LIMIT,
  });
}

export async function listPending() {
  return prisma.reservation.findMany({
    where: { status: 'pending' },
    include: { book: true, member: true },
    orderBy: { createdAt: 'asc' },
    take: LIST_LIMIT,
  });
}

export async function listActiveForMemberAndBook(
  memberId: string,
  bookId: string,
): Promise<ReservationWithRelations[]> {
  return prisma.reservation.findMany({
    where: { memberId, bookId, status: { in: ['pending', 'approved'] } },
    include: RESERVATION_INCLUDE,
    orderBy: { createdAt: 'desc' },
  });
}

export async function listPendingForBooks(bookIds: string[]): Promise<Reservation[]> {
  return prisma.reservation.findMany({
    where: { bookId: { in: bookIds }, status: 'pending' },
    orderBy: { createdAt: 'asc' },
  });
}

// Serializes the active-reservation check and insert for one member/book via a
// transaction-scoped advisory lock.
export async function createReservationIfAllowed(opts: {
  memberId: string;
  bookId: string;
  blockingDueAfter: Date;
}): Promise<ReservationWithMember | null> {
  const lockKey = `reservation:${opts.memberId}:${opts.bookId}`;
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
    const existing = await tx.reservation.findMany({
      where: { memberId: opts.memberId, bookId: opts.bookId, status: { in: ['pending', 'approved'] } },
      include: RESERVATION_INCLUDE,
    });
    for (const reservation of existing) {
      if (reservation.status === 'pending') return null;
      const loan = reservation.loan;
      if (loan !== null && loan.returnedAt === null && loan.dueDate > opts.blockingDueAfter) {
        return null;
      }
    }
    return tx.reservation.create({
      data: { memberId: opts.memberId, bookId: opts.bookId },
      include: { ...RESERVATION_INCLUDE, member: true },
    });
  });
}

export async function cancelReservation(reservationId: string): Promise<ReservationWithRelations> {
  return prisma.reservation.update({
    where: { id: reservationId },
    data: { status: 'cancelled' },
    include: RESERVATION_INCLUDE,
  });
}

export async function approve(
  reservationId: string,
  loanId: string,
  client?: Prisma.TransactionClient,
): Promise<ReservationWithRelations> {
  const db = client ?? prisma;
  return db.reservation.update({
    where: { id: reservationId },
    data: { status: 'approved', loanId },
    include: RESERVATION_INCLUDE,
  });
}

// Callers must hold the same advisory lock approve() runs under — a status guard alone
// isn't enough: approve's own write is unconditional, so an approve that read "pending"
// before a rejection committed would silently overwrite it.
export async function reject(
  reservationId: string,
  client?: Prisma.TransactionClient,
): Promise<ReservationWithRelations> {
  const db = client ?? prisma;
  return db.reservation.update({
    where: { id: reservationId },
    data: { status: 'rejected' },
    include: RESERVATION_INCLUDE,
  });
}
