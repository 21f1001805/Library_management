import { z } from 'zod';

import type { SeatBooking } from '@prisma/client';
import { SEAT_LABELS } from '@/server/seatBooking/constants';

// Mirrors backend/src/app/modules/seat_booking/schemas.py. `date` is a plain calendar
// date string ("YYYY-MM-DD"), same as Pydantic's `date` type serializes to.
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD');
const seatLabel = z.string().refine((value) => SEAT_LABELS.includes(value), {
  message: 'Unknown seat',
});

export const seatBookingCreateSchema = z.object({
  seat_label: seatLabel,
  date: dateString,
  hour: z.number().int().min(0).max(23),
});
export type SeatBookingCreateInput = z.infer<typeof seatBookingCreateSchema>;

export const seatNotifyCreateSchema = z.object({
  seat_label: seatLabel,
  date: dateString,
  hour: z.number().int().min(0).max(23),
});
export type SeatNotifyCreateInput = z.infer<typeof seatNotifyCreateSchema>;

export interface SeatSlotOut {
  seat_label: string;
  status: 'available' | 'reserved' | 'booked_by_me' | 'booked_for_child';
  booking_id: string | null;
  booked_by_avatar_url: string | null;
  booked_for_child_id: string | null;
  booked_for_child_name: string | null;
  booked_by_guardian_id: string | null;
  booked_by_guardian_name: string | null;
}

export function emptySeatSlot(seatLabel: string, overrides: Partial<SeatSlotOut> = {}): SeatSlotOut {
  return {
    seat_label: seatLabel,
    status: 'available',
    booking_id: null,
    booked_by_avatar_url: null,
    booked_for_child_id: null,
    booked_for_child_name: null,
    booked_by_guardian_id: null,
    booked_by_guardian_name: null,
    ...overrides,
  };
}

export interface ScheduleOut {
  date: string;
  hour: number;
  seats: SeatSlotOut[];
}

export interface SeatAvailabilitySummary {
  available: number;
  booked: number;
  total: number;
}

export interface SeatBookingOut {
  id: string;
  seat_label: string;
  date: string;
  hour: number;
  created_at: string;
}

export function seatBookingToJson(booking: SeatBooking): SeatBookingOut {
  return {
    id: booking.id,
    seat_label: booking.seatLabel,
    date: booking.date.toISOString().slice(0, 10),
    hour: booking.hour,
    created_at: booking.createdAt.toISOString(),
  };
}
