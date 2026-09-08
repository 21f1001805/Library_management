import { NextResponse } from 'next/server';

import { withErrorHandling } from '@/server/http';
import { getCurrentUser } from '@/server/auth/guards';
import * as seatBookingService from '@/server/seatBooking/service';

export const DELETE = withErrorHandling(async (request, { params }) => {
  const user = await getCurrentUser(request);
  const { bookingId } = await params;
  await seatBookingService.cancelBooking(user, bookingId as string);
  return new NextResponse(null, { status: 204 });
});
