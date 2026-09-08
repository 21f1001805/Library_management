import { NextResponse } from 'next/server';

import { withErrorHandling } from '@/server/http';
import { getCurrentUser } from '@/server/auth/guards';
import * as seatBookingService from '@/server/seatBooking/service';

export const GET = withErrorHandling(async (request) => {
  const user = await getCurrentUser(request);
  const bookings = await seatBookingService.listMyBookings(user);
  return NextResponse.json(bookings);
});
