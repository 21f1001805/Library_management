import { NextResponse } from 'next/server';

import { withErrorHandling, readJsonBody } from '@/server/http';
import { getCurrentUser } from '@/server/auth/guards';
import { enforceRateLimit } from '@/server/rateLimit';
import { chatRequestSchema } from '@/server/chat/schemas';
import * as chatHistory from '@/server/chat/history';
import { runChat } from '@/server/chat/orchestrator';

// Mirrors backend/src/app/modules/chat/router.py.

export const POST = withErrorHandling(async (request) => {
  const user = await getCurrentUser(request);
  await enforceRateLimit(request, 'chat', 20, 60);
  const payload = chatRequestSchema.parse(await readJsonBody(request));

  const history = await chatHistory.loadHistory(user.id);
  const response = await runChat({ message: payload.message, history, user });

  if (response.source !== 'error') {
    await chatHistory.appendTurn(user.id, payload.message, response.reply);
  }
  return NextResponse.json(response);
});
