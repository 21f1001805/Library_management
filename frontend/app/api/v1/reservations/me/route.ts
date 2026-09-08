import { NextResponse } from 'next/server';

import { withErrorHandling } from '@/server/http';
import { getCurrentUser } from '@/server/auth/guards';
import * as reservationsService from '@/server/reservations/service';

export const GET = withErrorHandling(async (request) => {
  const user = await getCurrentUser(request);
  const reservations = await reservationsService.listMyReservations(user.id);
  return NextResponse.json(reservations);
});
