import type { Prisma, SeatBooking, SeatNotifyRequest } from '@prisma/client';

import { prisma } from '@/server/db';

// Mirrors backend/src/app/modules/seat_booking/repository.py. Dates are stored at
// midnight UTC (a plain calendar date, no time-of-day component).
function toDateTime(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

const BOOKING_INCLUDE = { member: true } satisfies Prisma.SeatBookingInclude;
export type SeatBookingWithMember = Prisma.SeatBookingGetPayload<{ include: typeof BOOKING_INCLUDE }>;

export async function listBookingsForSlot(date: string, hour: number): Promise<SeatBookingWithMember[]> {
  // include=member so the caller can show who a *reserved* (someone else's) seat
  // belongs to (avatar) without a second round-trip per booking.
  return prisma.seatBooking.findMany({
    where: { date: toDateTime(date), hour },
    include: BOOKING_INCLUDE,
  });
}

export async function findBooking(bookingId: string): Promise<SeatBooking | null> {
  return prisma.seatBooking.findUnique({ where: { id: bookingId } });
}

export async function createBooking(
  memberId: string,
  seatLabel: string,
  date: string,
  hour: number,
): Promise<SeatBooking> {
  return prisma.seatBooking.create({
    data: { memberId, seatLabel, date: toDateTime(date), hour },
  });
}

export async function deleteBooking(bookingId: string): Promise<void> {
  await prisma.seatBooking.delete({ where: { id: bookingId } });
}

export async function listMyBookings(memberId: string): Promise<SeatBooking[]> {
  return prisma.seatBooking.findMany({
    where: { memberId },
    orderBy: [{ date: 'asc' }, { hour: 'asc' }],
  });
}

export async function findNotifyRequestsForSlot(
  seatLabel: string,
  date: string,
  hour: number,
): Promise<SeatNotifyRequest[]> {
  return prisma.seatNotifyRequest.findMany({
    where: { seatLabel, date: toDateTime(date), hour },
  });
}

export async function createNotifyRequest(
  memberId: string,
  seatLabel: string,
  date: string,
  hour: number,
): Promise<SeatNotifyRequest> {
  const prismaDate = toDateTime(date);
  return prisma.seatNotifyRequest.upsert({
    where: { seatLabel_date_hour_memberId: { seatLabel, date: prismaDate, hour, memberId } },
    create: { memberId, seatLabel, date: prismaDate, hour },
    update: {},
  });
}

export async function deleteNotifyRequests(ids: string[]): Promise<void> {
  await prisma.seatNotifyRequest.deleteMany({ where: { id: { in: ids } } });
}
