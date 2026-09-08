import { z } from 'zod';

import type { ReservationWithRelations } from '@/server/reservations/repository';

// Mirrors backend/src/app/modules/reservations/schemas.py.
export const reservationCreateSchema = z.object({
  book_id: z.string(),
});
export type ReservationCreateInput = z.infer<typeof reservationCreateSchema>;

export interface ReservationOut {
  id: string;
  book_id: string;
  book_title: string;
  status: string;
  due_date: string | null;
  created_at: string;
  queue_position: number | null;
  eta_days: number | null;
}

export function reservationToJson(
  reservation: ReservationWithRelations,
  opts: { queuePosition?: number | null; etaDays?: number | null } = {},
): ReservationOut {
  return {
    id: reservation.id,
    book_id: reservation.bookId,
    book_title: reservation.book.title,
    status: reservation.status,
    due_date: reservation.loan?.dueDate.toISOString() ?? null,
    created_at: reservation.createdAt.toISOString(),
    queue_position: opts.queuePosition ?? null,
    eta_days: opts.etaDays ?? null,
  };
}
