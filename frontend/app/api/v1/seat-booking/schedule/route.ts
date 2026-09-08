import { NextResponse } from 'next/server';
import { z } from 'zod';

import { withErrorHandling } from '@/server/http';
import { getCurrentUser } from '@/server/auth/guards';
import * as seatBookingService from '@/server/seatBooking/service';

const querySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hour: z.coerce.number().int().min(0).max(23),
});

export const GET = withErrorHandling(async (request) => {
  const user = await getCurrentUser(request);
  const url = new URL(request.url);
  const query = querySchema.parse({
    date: url.searchParams.get('date'),
    hour: url.searchParams.get('hour'),
  });
  const schedule = await seatBookingService.getSchedule(user, query.date, query.hour);
  return NextResponse.json(schedule);
});
