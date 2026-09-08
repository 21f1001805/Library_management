import { NextResponse } from 'next/server';

import { withErrorHandling, readJsonBody } from '@/server/http';
import { getCurrentUser } from '@/server/auth/guards';
import { readingProgressUpsertSchema } from '@/server/members/schemas';
import * as membersService from '@/server/members/service';

// Mirrors backend/src/app/modules/members/router.py.

export const GET = withErrorHandling(async (request) => {
  const user = await getCurrentUser(request);
  const progress = await membersService.listReadingProgress(user.id);
  return NextResponse.json(progress);
});

export const PUT = withErrorHandling(async (request) => {
  const user = await getCurrentUser(request);
  const payload = readingProgressUpsertSchema.parse(await readJsonBody(request));
  const progress = await membersService.recordReadingProgress(user.id, payload);
  return NextResponse.json(progress);
});
