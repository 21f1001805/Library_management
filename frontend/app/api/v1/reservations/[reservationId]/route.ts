import { NextResponse } from 'next/server';

import { withErrorHandling } from '@/server/http';
import { getCurrentUser } from '@/server/auth/guards';
import * as reservationsService from '@/server/reservations/service';

export const DELETE = withErrorHandling(async (request, { params }) => {
  const user = await getCurrentUser(request);
  const { reservationId } = await params;
  await reservationsService.cancelReservation(user.id, reservationId as string);
  return new NextResponse(null, { status: 204 });
});
