import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { apiUrl } from '@/lib/api';
import { subscribeToSSE } from '@/lib/sse';
import { useAuth } from '@/providers/AuthProvider';

import { reservationKeys } from './useReservationsQuery';

/**
 * Keeps reservationKeys.mine live: a manager's approve/reject lands on a different
 * device entirely, so the member's tab has no way to know unless the server tells it.
 * The backend publishes to Redis the instant the decision commits
 * (reservations/events.py) and this invalidates the query so it refetches.
 *
 * Invalidate rather than write the payload straight into the cache, which is what
 * useVisitStatusStream does with its own push: a reservation's queue position and ETA
 * are computed against every *other* member's pending requests and active loans, so the
 * only correct value is the one the server derives at read time. The signal says "your
 * list is stale", not "here is the new list" — see the module docstring on the backend
 * side for the same reasoning.
 *
 * Depends on `token` in the effect deps so a silent token refresh reconnects the stream
 * with the new credential automatically.
 */
export function useReservationsStream() {
  const { token, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isAuthenticated || !token) return;

    const unsubscribe = subscribeToSSE(apiUrl('/reservations/stream'), token, () => {
      void queryClient.invalidateQueries({ queryKey: reservationKeys.mine });
    });

    return unsubscribe;
  }, [token, isAuthenticated, queryClient]);
}
