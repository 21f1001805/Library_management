import { NextResponse } from 'next/server';

import { withErrorHandling, readJsonBody } from '@/server/http';
import { getCurrentUser } from '@/server/auth/guards';
import { selfGuardianLinkCreateSchema } from '@/server/guardian/schemas';
import * as guardianService from '@/server/guardian/service';

// Any signed-in user asking about their own link — not gated on the guardian role,
// since the caller here is the student. Scoped to user.id, so it can only ever return
// their own.
export const GET = withErrorHandling(async (request) => {
  const user = await getCurrentUser(request);
  const guardian = await guardianService.getMyGuardian(user.id);
  return NextResponse.json(guardian);
});

export const POST = withErrorHandling(async (request) => {
  const user = await getCurrentUser(request);
  const payload = selfGuardianLinkCreateSchema.parse(await readJsonBody(request));
  const guardian = await guardianService.linkMyGuardian(user.id, payload.guardian_email);
  return NextResponse.json(guardian);
});

export const DELETE = withErrorHandling(async (request) => {
  const user = await getCurrentUser(request);
  await guardianService.unlinkMyGuardian(user.id);
  return new NextResponse(null, { status: 204 });
});
