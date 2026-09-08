import { withErrorHandling } from '@/server/http';
import { getCurrentUser } from '@/server/auth/guards';
import { reservationChannel } from '@/server/reservations/events';
import { sseResponseForChannel } from '@/server/sse';

// Mirrors backend/src/app/modules/reservations/router.py's /stream endpoint.
export const GET = withErrorHandling(async (request) => {
  const user = await getCurrentUser(request);
  return sseResponseForChannel(request, reservationChannel(user.id), (message) => `data: ${message}\n\n`);
});
