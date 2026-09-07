import { useQuery } from '@tanstack/react-query';

import { useAuth, type Reservation } from '@/providers/AuthProvider';

export const reservationKeys = { mine: ['reservations', 'me'] as const };

/**
 * A manager approves or rejects from their own screen, so the member's list changes
 * without their tab doing anything — the same "changes from outside this tab" reason
 * useNotificationsQuery polls. useReservationsStream pushes those decisions instantly;
 * this interval stays underneath as the fallback for when that connection is down.
 */
const POLL_INTERVAL_MS = 30_000;

const EMPTY: Reservation[] = [];

/**
 * The single source of truth for "my reservations". The dashboard's stat card and the
 * reservations page both read it, so one push or poll refreshes both at once instead of
 * each holding its own copy that drifts out of agreement.
 */
export function useReservationsQuery() {
  const { getMyReservations, isAuthenticated } = useAuth();

  const query = useQuery({
    queryKey: reservationKeys.mine,
    queryFn: getMyReservations,
    enabled: isAuthenticated,
    refetchInterval: POLL_INTERVAL_MS,
    staleTime: POLL_INTERVAL_MS,
  });

  return { ...query, reservations: query.data ?? EMPTY };
}
