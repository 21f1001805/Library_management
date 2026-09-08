import { NextResponse } from 'next/server';
import { z } from 'zod';

import { withErrorHandling } from '@/server/http';
import { getCurrentUser } from '@/server/auth/guards';
import { FOOTFALL_RANGES } from '@/server/manager/schemas';
import * as managerService from '@/server/manager/service';

const querySchema = z.object({ range: z.enum(FOOTFALL_RANGES).default('7d') });

export const GET = withErrorHandling(async (request) => {
  await getCurrentUser(request);
  const url = new URL(request.url);
  const query = querySchema.parse({ range: url.searchParams.get('range') ?? undefined });
  const analytics = await managerService.getFootfallAnalytics(query.range);
  return NextResponse.json(analytics);
});
