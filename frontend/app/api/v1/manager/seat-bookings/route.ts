import { NextResponse } from 'next/server';

import { withErrorHandling, readJsonBody } from '@/server/http';
import { requireRole } from '@/server/auth/guards';
import { Role } from '@/server/constants';
import { managerSeatBookingCreateSchema } from '@/server/manager/schemas';
import * as managerService from '@/server/manager/service';

export const POST = withErrorHandling(async (request) => {
  await requireRole(request, Role.MANAGER, Role.LIBRARIAN);
  const payload = managerSeatBookingCreateSchema.parse(await readJsonBody(request));
  const booking = await managerService.bookSeatForMember(payload);
  return NextResponse.json(booking, { status: 201 });
});
