import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { apiUrl } from '@/lib/api';
import { subscribeToSSE } from '@/lib/sse';
import { useAuth, type MemberVisitStatus } from '@/providers/AuthProvider';

import { visitStatusKeys } from './useVisitStatusQuery';

/**
 * Keeps visitStatusKeys.mine live in real time: a staff check-in/out happens on a
 * completely different device, so the member's own tab has no way to know unless the
 * server tells it. The backend publishes to Redis the instant it happens
 * (visits/events.py) and this stream pushes that straight into the query cache —
 * useVisitStatusQuery's own 30s poll stays on underneath as a fallback for the rare
 * case this connection is down and hasn't reconnected yet.
 *
 * Depends on `token` in the effect deps: when AuthProvider silently refreshes an
 * expiring access token (any other request 401ing triggers this), the effect re-runs
 * and reconnects with the new token automatically.
 */
export function useVisitStatusStream() {
  const { token, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isAuthenticated || !token) return;

    const unsubscribe = subscribeToSSE(apiUrl('/visits/my-status/stream'), token, (data) => {
      try {
        const parsed = JSON.parse(data) as MemberVisitStatus;
        queryClient.setQueryData(visitStatusKeys.mine, parsed);
      } catch {
        // Malformed payload — ignore; the next poll or push will still catch up.
      }
    });

    return unsubscribe;
  }, [token, isAuthenticated, queryClient]);
}
