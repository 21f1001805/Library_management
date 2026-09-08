import { withErrorHandling } from '@/server/http';
import { getCurrentUser } from '@/server/auth/guards';
import { visitStatusChannel } from '@/server/visits/events';
import { sseResponseForChannel } from '@/server/sse';

// Mirrors backend/src/app/modules/visits/router.py's /my-status/stream endpoint.
export const GET = withErrorHandling(async (request) => {
  const user = await getCurrentUser(request);
  return sseResponseForChannel(request, visitStatusChannel(user.id), (message) => `data: ${message}\n\n`);
});
