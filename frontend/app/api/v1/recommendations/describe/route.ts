import { NextResponse } from 'next/server';

import { withErrorHandling, readJsonBody } from '@/server/http';
import { requireRole } from '@/server/auth/guards';
import { enforceRateLimit } from '@/server/rateLimit';
import { Role } from '@/server/constants';
import { describeRequestSchema } from '@/server/recommendations/schemas';
import * as recommendationsService from '@/server/recommendations/service';

// Mirrors backend/src/app/modules/recommendations/router.py.

export const POST = withErrorHandling(async (request) => {
  const user = await requireRole(request, Role.MEMBER);
  await enforceRateLimit(request, 'recommendations:describe', 10, 60);
  const payload = describeRequestSchema.parse(await readJsonBody(request));
  const result = await recommendationsService.describeAndRecommend(user.id, payload.description);
  return NextResponse.json(result);
});
