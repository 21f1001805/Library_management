import { NextResponse } from 'next/server';

import { withErrorHandling, readJsonBody } from '@/server/http';
import { enforceRateLimit } from '@/server/rateLimit';
import { translateBatchRequestSchema } from '@/server/translate/schemas';
import * as translateService from '@/server/translate/service';

// Mirrors backend/src/app/modules/translate/router.py. Public — no Depends in the Python
// router.

export const POST = withErrorHandling(async (request) => {
  await enforceRateLimit(request, 'translate:batch', 10, 60);
  const payload = translateBatchRequestSchema.parse(await readJsonBody(request));
  const result = await translateService.translateBatch(payload);
  return NextResponse.json(result);
});
