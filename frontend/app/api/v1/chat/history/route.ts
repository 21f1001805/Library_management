import { NextResponse } from 'next/server';

import { withErrorHandling } from '@/server/http';
import { getCurrentUser } from '@/server/auth/guards';
import * as chatHistory from '@/server/chat/history';

// Mirrors backend/src/app/modules/chat/router.py.

export const DELETE = withErrorHandling(async (request) => {
  const user = await getCurrentUser(request);
  await chatHistory.clearHistory(user.id);
  return new NextResponse(null, { status: 204 });
});
