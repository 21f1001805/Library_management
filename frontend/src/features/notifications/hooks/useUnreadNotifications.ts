import { useEffect, useRef, useState } from 'react';

import { useAuth } from '@/providers/AuthProvider';

const POLL_INTERVAL_MS = 30_000;
// How long the bell keeps "ringing" after a genuinely new notification shows up,
// as opposed to the steady gold tint which stays for as long as anything is unread.
const JUST_ARRIVED_DURATION_MS = 4_000;

export function useUnreadNotifications() {
  const { getMyNotifications } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [justArrived, setJustArrived] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  // null until the first poll resolves, so that poll doesn't treat a member's
  // entire pre-existing unread pile as "new" the moment the app loads.
  const seenIds = useRef<Set<string> | null>(null);

  useEffect(() => {
    let cancelled = false;
    let justArrivedTimer: ReturnType<typeof setTimeout> | undefined;

    function poll() {
      getMyNotifications()
        .then((notifications) => {
          if (cancelled) return;
          const unread = notifications.filter((notification) => !notification.read);
          setUnreadCount(unread.length);

          const unreadIds = new Set(unread.map((notification) => notification.id));
          const previouslySeen = seenIds.current;
          if (previouslySeen) {
            let hasNew = false;
            unreadIds.forEach((id) => {
              if (!previouslySeen.has(id)) hasNew = true;
            });
            if (hasNew) {
              setJustArrived(true);
              clearTimeout(justArrivedTimer);
              justArrivedTimer = setTimeout(() => {
                if (!cancelled) setJustArrived(false);
              }, JUST_ARRIVED_DURATION_MS);
            }
          }
          seenIds.current = unreadIds;
        })
        .catch(() => {
          if (!cancelled) setUnreadCount(0);
        });
    }

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
      clearTimeout(justArrivedTimer);
    };
  }, [getMyNotifications, reloadKey]);

  return { unreadCount, justArrived, refresh: () => setReloadKey((key) => key + 1) };
}
