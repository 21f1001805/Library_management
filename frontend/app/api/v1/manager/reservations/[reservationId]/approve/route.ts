import { NextResponse } from 'next/server';

import { withErrorHandling, readJsonBody } from '@/server/http';
import { requireRole } from '@/server/auth/guards';
import { Role } from '@/server/constants';
import { managerReservationDecisionSchema } from '@/server/manager/schemas';
import * as managerService from '@/server/manager/service';

export const POST = withErrorHandling(async (request, { params }) => {
  const user = await requireRole(request, Role.MANAGER, Role.LIBRARIAN);
  const { reservationId } = await params;
  const payload = managerReservationDecisionSchema.parse(await readJsonBody(request));
  const reservation = await managerService.approveReservation(
    user.id,
    reservationId as string,
    payload.duration_days,
  );
  return NextResponse.json(reservation);
});
