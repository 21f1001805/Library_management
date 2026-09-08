import { NextResponse } from 'next/server';

import { withErrorHandling, readJsonBody } from '@/server/http';
import { requireRole } from '@/server/auth/guards';
import { Role } from '@/server/constants';
import { seatNotifyCreateSchema } from '@/server/seatBooking/schemas';
import * as guardianService from '@/server/guardian/service';

export const POST = withErrorHandling(async (request, { params }) => {
  const user = await requireRole(request, Role.GUARDIAN);
  const { childId } = await params;
  const payload = seatNotifyCreateSchema.parse(await readJsonBody(request));
  await guardianService.requestSeatNotifyForChild(user.id, childId as string, payload);
  return new NextResponse(null, { status: 204 });
});
