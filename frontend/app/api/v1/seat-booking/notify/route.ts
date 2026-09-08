import { NextResponse } from 'next/server';

import { withErrorHandling, readJsonBody } from '@/server/http';
import { getCurrentUser } from '@/server/auth/guards';
import { seatNotifyCreateSchema } from '@/server/seatBooking/schemas';
import * as seatBookingService from '@/server/seatBooking/service';

export const POST = withErrorHandling(async (request) => {
  const user = await getCurrentUser(request);
  const payload = seatNotifyCreateSchema.parse(await readJsonBody(request));
  await seatBookingService.requestNotify(user, payload);
  return new NextResponse(null, { status: 204 });
});
