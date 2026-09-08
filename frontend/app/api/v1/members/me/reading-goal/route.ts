import { NextResponse } from 'next/server';

import { withErrorHandling, readJsonBody } from '@/server/http';
import { getCurrentUser } from '@/server/auth/guards';
import { readingGoalUpsertSchema } from '@/server/members/schemas';
import * as membersService from '@/server/members/service';

// Mirrors backend/src/app/modules/members/router.py.

export const GET = withErrorHandling(async (request) => {
  const user = await getCurrentUser(request);
  const goal = await membersService.getReadingGoal(user.id);
  return NextResponse.json(goal);
});

export const PUT = withErrorHandling(async (request) => {
  const user = await getCurrentUser(request);
  const payload = readingGoalUpsertSchema.parse(await readJsonBody(request));
  const goal = await membersService.upsertReadingGoal(user.id, payload);
  return NextResponse.json(goal);
});
