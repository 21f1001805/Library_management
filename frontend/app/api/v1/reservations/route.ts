import { NextResponse } from 'next/server';

import { withErrorHandling, readJsonBody } from '@/server/http';
import { getCurrentUser } from '@/server/auth/guards';
import { reservationCreateSchema } from '@/server/reservations/schemas';
import * as reservationsService from '@/server/reservations/service';

export const POST = withErrorHandling(async (request) => {
  const user = await getCurrentUser(request);
  const payload = reservationCreateSchema.parse(await readJsonBody(request));
  const reservation = await reservationsService.createReservation(user.id, payload);
  return NextResponse.json(reservation, { status: 201 });
});
