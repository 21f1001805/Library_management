import { NextResponse } from 'next/server';

import { withErrorHandling, readJsonBody } from '@/server/http';
import { getCurrentUser } from '@/server/auth/guards';
import { seatBookingCreateSchema } from '@/server/seatBooking/schemas';
import * as seatBookingService from '@/server/seatBooking/service';

export const POST = withErrorHandling(async (request) => {
  const user = await getCurrentUser(request);
  const payload = seatBookingCreateSchema.parse(await readJsonBody(request));
  const booking = await seatBookingService.bookSeat(user, payload);
  return NextResponse.json(booking, { status: 201 });
});
