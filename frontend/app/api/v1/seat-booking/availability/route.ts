import { NextResponse } from 'next/server';
import { z } from 'zod';

import { withErrorHandling } from '@/server/http';
import * as seatBookingService from '@/server/seatBooking/service';

const querySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  hour: z.coerce.number().int().min(0).max(23).optional(),
});

export const GET = withErrorHandling(async (request) => {
  const url = new URL(request.url);
  const query = querySchema.parse({
    date: url.searchParams.get('date') ?? undefined,
    hour: url.searchParams.get('hour') ?? undefined,
  });
  const summary = await seatBookingService.getAvailabilitySummary(query.date, query.hour);
  return NextResponse.json(summary);
});
