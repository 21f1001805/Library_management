import { NextResponse } from 'next/server';

import { withErrorHandling } from '@/server/http';
import * as eventsService from '@/server/events/service';

export const GET = withErrorHandling(async () => {
  const summary = await eventsService.getAttendanceSummary();
  return NextResponse.json(summary);
});
