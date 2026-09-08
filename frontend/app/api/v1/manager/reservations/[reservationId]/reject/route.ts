import { NextResponse } from 'next/server';

import { withErrorHandling } from '@/server/http';
import { requireRole } from '@/server/auth/guards';
import { Role } from '@/server/constants';
import * as managerService from '@/server/manager/service';

export const POST = withErrorHandling(async (request, { params }) => {
  await requireRole(request, Role.MANAGER, Role.LIBRARIAN);
  const { reservationId } = await params;
  const reservation = await managerService.rejectReservation(reservationId as string);
  return NextResponse.json(reservation);
});
