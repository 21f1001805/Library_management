import { useQuery } from '@tanstack/react-query';

import { useAuth, type MemberVisitStatus } from '@/providers/AuthProvider';

export const visitStatusKeys = { mine: ['visits', 'my-status'] as const };

/**
 * A staff member checks someone in/out from a different device (Manager/Librarian's own
 * screen) — the member's own dashboard tab has no way to learn that happened unless it
 * asks again, so this polls instead of fetching once on mount like a plain useEffect.
 * Matches the interval useNotificationsQuery already uses for the same "changes from
 * outside this tab" reason.
 */
const POLL_INTERVAL_MS = 30_000;

export function useVisitStatusQuery() {
  const { getMyVisitStatus, isAuthenticated } = useAuth();

  return useQuery<MemberVisitStatus>({
    queryKey: visitStatusKeys.mine,
    queryFn: getMyVisitStatus,
    enabled: isAuthenticated,
    refetchInterval: POLL_INTERVAL_MS,
    staleTime: POLL_INTERVAL_MS,
  });
}
