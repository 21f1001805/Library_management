import { NextResponse } from 'next/server';

import { withErrorHandling, readJsonBody } from '@/server/http';
import { enforceRateLimit } from '@/server/rateLimit';
import { translateRequestSchema } from '@/server/translate/schemas';
import * as translateService from '@/server/translate/service';

// Mirrors backend/src/app/modules/translate/router.py. Public — no Depends in the Python
// router.

export const POST = withErrorHandling(async (request) => {
  await enforceRateLimit(request, 'translate:text', 30, 60);
  const payload = translateRequestSchema.parse(await readJsonBody(request));
  const result = await translateService.translateText(payload);
  return NextResponse.json(result);
});
