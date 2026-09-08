import { Prisma, type SeatBooking } from '@prisma/client';

import { HttpError } from '@/server/http';
import type { AuthenticatedUser } from '@/server/auth/guards';
import * as guardianRepository from '@/server/guardian/repository';
import * as notificationsRepository from '@/server/notifications/repository';
import * as notificationsService from '@/server/notifications/service';
import * as repository from '@/server/seatBooking/repository';
import { MAX_DAYS_AHEAD, SEAT_LABELS } from '@/server/seatBooking/constants';
import {
  emptySeatSlot,
  seatBookingToJson,
  type ScheduleOut,
  type SeatAvailabilitySummary,
  type SeatBookingCreateInput,
  type SeatBookingOut,
  type SeatNotifyCreateInput,
  type SeatSlotOut,
} from '@/server/seatBooking/schemas';

// Mirrors backend/src/app/modules/seat_booking/service.py.

function todayString(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function validateSlot(targetDate: string, hour: number): void {
  const now = new Date();
  const today = todayString(now);
  const maxDate = todayString(new Date(now.getTime() + MAX_DAYS_AHEAD * 24 * 60 * 60 * 1000));

  if (targetDate < today) {
    throw new HttpError(400, 'Cannot book a date in the past');
  }
  if (targetDate > maxDate) {
    throw new HttpError(400, `Bookings can only be made up to ${MAX_DAYS_AHEAD} days ahead`);
  }
  if (targetDate === today && hour < now.getUTCHours()) {
    throw new HttpError(400, 'Cannot book a time slot that has already passed');
  }
}

export async function getAvailabilitySummary(
  targetDate?: string,
  hour?: number,
): Promise<SeatAvailabilitySummary> {
  const now = new Date();
  const date = targetDate ?? todayString(now);
  const slotHour = hour ?? now.getUTCHours();

  const bookings = await repository.listBookingsForSlot(date, slotHour);
  const booked = bookings.length;
  const total = SEAT_LABELS.length;
  return { available: total - booked, booked, total };
}

export async function getSchedule(
  user: AuthenticatedUser,
  targetDate: string,
  hour: number,
): Promise<ScheduleOut> {
  const bookings = await repository.listBookingsForSlot(targetDate, hour);
  const bySeat = new Map(bookings.map((booking) => [booking.seatLabel, booking]));

  const children = await guardianRepository.listChildren(user.id);
  const childMap = new Map(children.map((child) => [child.id, child]));

  const guardianNotifs = await notificationsRepository.listForUser(user.id);
  const guardianBookedSeats = new Set<string>();
  const suffix = `for ${targetDate} at ${String(hour).padStart(2, '0')}:00`;
  for (const notif of guardianNotifs) {
    if (notif.type === 'seat-booked-by-guardian' && notif.message.includes(suffix)) {
      const parts = notif.message.split(' ');
      if (parts.length >= 2 && parts[0] === 'Seat') {
        guardianBookedSeats.add(parts[1]);
      }
    }
  }

  const slots: SeatSlotOut[] = [];
  for (const label of SEAT_LABELS) {
    const booking = bySeat.get(label);
    if (!booking) {
      slots.push(emptySeatSlot(label));
      continue;
    }
    if (booking.memberId === user.id) {
      const isBookedByGuardian = guardianBookedSeats.has(label);
      const guardian = isBookedByGuardian
        ? await guardianRepository.findGuardianForChild(user.id)
        : null;
      slots.push(
        emptySeatSlot(label, {
          status: 'booked_by_me',
          booking_id: booking.id,
          booked_by_avatar_url: user.avatarUrl,
          booked_by_guardian_id: guardian?.id ?? null,
          booked_by_guardian_name: guardian?.fullName ?? null,
        }),
      );
      continue;
    }
    const child = childMap.get(booking.memberId);
    if (child) {
      slots.push(
        emptySeatSlot(label, {
          status: 'booked_for_child',
          booking_id: booking.id,
          booked_by_avatar_url: child.avatarUrl ?? booking.member?.avatarUrl ?? null,
          booked_for_child_id: child.id,
          booked_for_child_name: child.fullName,
        }),
      );
      continue;
    }
    slots.push(
      emptySeatSlot(label, {
        status: 'reserved',
        booked_by_avatar_url: booking.member?.avatarUrl ?? null,
      }),
    );
  }

  return { date: targetDate, hour, seats: slots };
}

export async function bookSeat(
  user: AuthenticatedUser,
  payload: SeatBookingCreateInput,
): Promise<SeatBookingOut> {
  validateSlot(payload.date, payload.hour);

  const existing = await repository.listBookingsForSlot(payload.date, payload.hour);
  if (existing.some((booking) => booking.seatLabel === payload.seat_label)) {
    throw new HttpError(409, 'This seat is already booked for that time');
  }
  if (existing.some((booking) => booking.memberId === user.id)) {
    throw new HttpError(409, 'You already have a seat booked for this time slot');
  }

  let booking: SeatBooking;
  try {
    booking = await repository.createBooking(user.id, payload.seat_label, payload.date, payload.hour);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new HttpError(409, 'This seat is already booked for that time');
    }
    throw err;
  }

  await notificationsService.createNotification(
    user.id,
    'seat-booked',
    `Seat ${payload.seat_label} booked for ${payload.date} at ${String(payload.hour).padStart(2, '0')}:00.`,
  );
  return seatBookingToJson(booking);
}

export async function listMyBookings(user: AuthenticatedUser): Promise<SeatBookingOut[]> {
  const bookings = await repository.listMyBookings(user.id);
  return bookings.map(seatBookingToJson);
}

export async function cancelBooking(user: AuthenticatedUser, bookingId: string): Promise<void> {
  const booking = await repository.findBooking(bookingId);
  if (!booking) throw new HttpError(404, 'Booking not found');
  if (booking.memberId !== user.id) {
    const children = await guardianRepository.listChildren(user.id);
    if (!children.some((child) => child.id === booking.memberId)) {
      throw new HttpError(403, 'You can only cancel your own bookings');
    }
  }

  const bookingDate = booking.date.toISOString().slice(0, 10);
  await repository.deleteBooking(bookingId);

  const waiting = await repository.findNotifyRequestsForSlot(
    booking.seatLabel,
    bookingDate,
    booking.hour,
  );
  if (waiting.length > 0) {
    await notificationsService.createNotifications(
      waiting.map((request) => request.memberId),
      'seat-available',
      `Seat ${booking.seatLabel} is now available on ${bookingDate} at ${String(booking.hour).padStart(2, '0')}:00.`,
    );
    await repository.deleteNotifyRequests(waiting.map((request) => request.id));
  }
}

export async function requestNotify(
  user: AuthenticatedUser,
  payload: SeatNotifyCreateInput,
): Promise<void> {
  validateSlot(payload.date, payload.hour);

  const existing = await repository.listBookingsForSlot(payload.date, payload.hour);
  const booking = existing.find((b) => b.seatLabel === payload.seat_label);
  if (!booking) {
    throw new HttpError(400, 'This seat is already available — just book it');
  }
  if (booking.memberId === user.id) {
    throw new HttpError(400, 'You already have this seat booked');
  }

  await repository.createNotifyRequest(user.id, payload.seat_label, payload.date, payload.hour);
}
