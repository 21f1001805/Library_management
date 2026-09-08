import { HttpError } from '@/server/http';
import { Role } from '@/server/constants';
import { REMINDER_WINDOW_DAYS } from '@/server/loans/constants';
import * as booksRepository from '@/server/books/repository';
import * as loansRepository from '@/server/loans/repository';
import * as notificationsService from '@/server/notifications/service';
import * as events from '@/server/reservations/events';
import * as repository from '@/server/reservations/repository';
import type { ReservationWithRelations } from '@/server/reservations/repository';
import {
  reservationToJson,
  type ReservationCreateInput,
  type ReservationOut,
} from '@/server/reservations/schemas';

// Mirrors backend/src/app/modules/reservations/service.py.

async function notifyManagers(message: string): Promise<void> {
  await notificationsService.notifyRoles([Role.MANAGER], 'reservation-requested', message);
}

// Queue position and ETA for every pending reservation in `reservations`. Batched
// deliberately: doing this per reservation meant several queries each, so cost grew
// with the number of reservations — three queries cover any number of them.
async function queueInfoForBooks(
  reservations: ReservationWithRelations[],
): Promise<Map<string, [number | null, number | null]>> {
  const pendingOnes = reservations.filter((r) => r.status === 'pending');
  if (pendingOnes.length === 0) return new Map();

  const bookIds = [...new Set(pendingOnes.map((r) => r.bookId))];
  const [allPending, books, activeLoans] = await Promise.all([
    repository.listPendingForBooks(bookIds),
    booksRepository.listByIds(bookIds),
    loansRepository.listActiveForBooks(bookIds),
  ]);

  const queueByBook = new Map<string, string[]>();
  for (const row of allPending) {
    const list = queueByBook.get(row.bookId) ?? [];
    list.push(row.id);
    queueByBook.set(row.bookId, list);
  }

  const totalCopiesByBook = new Map(books.map((book) => [book.id, book.totalCopies]));
  const loansByBook = new Map<string, typeof activeLoans>();
  for (const loan of activeLoans) {
    const list = loansByBook.get(loan.bookId) ?? [];
    list.push(loan);
    loansByBook.set(loan.bookId, list);
  }

  const today = new Date();
  const info = new Map<string, [number | null, number | null]>();
  for (const r of pendingOnes) {
    const queue = queueByBook.get(r.bookId) ?? [];
    const index = queue.indexOf(r.id);
    const position = index === -1 ? null : index + 1;
    if (position === null) {
      info.set(r.id, [null, null]);
      continue;
    }

    const loansAhead = loansByBook.get(r.bookId) ?? [];
    const availableNow = Math.max(0, (totalCopiesByBook.get(r.bookId) ?? 0) - loansAhead.length);
    if (position <= availableNow) {
      info.set(r.id, [position, 0]);
      continue;
    }

    const needed = position - availableNow;
    let etaDays: number | null = null;
    if (needed <= loansAhead.length) {
      const eta = loansAhead[needed - 1].dueDate;
      etaDays = Math.max(
        0,
        Math.round(
          (Date.UTC(eta.getUTCFullYear(), eta.getUTCMonth(), eta.getUTCDate()) -
            Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())) /
            86_400_000,
        ),
      );
    }
    info.set(r.id, [position, etaDays]);
  }
  return info;
}

export async function listMyReservations(memberId: string): Promise<ReservationOut[]> {
  const reservations = await repository.listActiveForMember(memberId);
  const queueInfo = await queueInfoForBooks(reservations);

  return reservations.map((reservation) => {
    const [position, etaDays] = queueInfo.get(reservation.id) ?? [null, null];
    return reservationToJson(reservation, { queuePosition: position, etaDays });
  });
}

export async function createReservation(
  memberId: string,
  payload: ReservationCreateInput,
): Promise<ReservationOut> {
  const blockingDueAfter = new Date(Date.now() + REMINDER_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const reservation = await repository.createReservationIfAllowed({
    memberId,
    bookId: payload.book_id,
    blockingDueAfter,
  });
  if (!reservation) {
    throw new HttpError(409, 'You already have this book reserved or on loan');
  }

  await notificationsService.createNotification(
    memberId,
    'reservation-requested',
    `Your request to borrow "${reservation.book.title}" is awaiting manager approval.`,
  );
  await notifyManagers(`${reservation.member.fullName} requested to borrow "${reservation.book.title}".`);

  // Reuse the batched queue maths rather than keeping a second implementation that has
  // to stay in agreement with it — this is just the one-reservation case.
  const queueInfo = await queueInfoForBooks([reservation]);
  const [position, etaDays] = queueInfo.get(reservation.id) ?? [null, null];
  // The tab that made this request already has the result, but a member signed in on a
  // second device does not — same reason a manager's decision publishes.
  await events.publishReservationsChanged(memberId);
  return reservationToJson(reservation, { queuePosition: position, etaDays });
}

export async function cancelReservation(memberId: string, reservationId: string): Promise<void> {
  const reservation = await repository.findById(reservationId);
  if (!reservation || reservation.memberId !== memberId || reservation.status !== 'pending') {
    throw new HttpError(404, 'Reservation not found');
  }

  await repository.cancelReservation(reservationId);
  await events.publishReservationsChanged(memberId);
}
