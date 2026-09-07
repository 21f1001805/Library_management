import { useCallback, useEffect, useState } from 'react';

function getStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

function readStoredValue<T>(key: string, defaultValue: T): T {
  try {
    const stored = getStorage()?.getItem(key);
    return stored ? (JSON.parse(stored) as T) : defaultValue;
  } catch {
    return defaultValue;
  }
}

export function useLocalStorageState<T>(key: string, defaultValue: T) {
  // Always starts from defaultValue, even on the client — reading localStorage synchronously
  // in this initializer would make the client's first (hydrating) render return a different
  // value than the server's (which never sees localStorage at all, so it's always
  // defaultValue), and React treats that as a hydration mismatch. The effect below applies
  // the real stored value right after mount, same as ThemeProvider's resolveIsDark and
  // useScroll's window.scrollY read handle their own equivalent of this.
  const [value, setValue] = useState<T>(defaultValue);
  // True once the effect below has run at least once, i.e. `value` reflects the real stored
  // value rather than the always-signed-out-shaped defaultValue. Consumers that redirect based
  // on this value (AuthGuard's RequireAuth/RequireRole) must wait for this — otherwise every
  // fresh page load has a one-effect-cycle window where a real session reads as "missing" and
  // triggers a bogus redirect before this hook's own sync effect has had a chance to run.
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    // This is exactly the "synchronize with an external, non-reactive source once after
    // mount" case the set-state-in-effect rule can't distinguish from deriving state that
    // belongs in render instead — localStorage genuinely can't be read during render without
    // reintroducing the hydration mismatch this hook exists to avoid (see above).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValue(readStoredValue(key, defaultValue));
    setIsHydrated(true);

    function syncFromAnotherTab(event: StorageEvent) {
      if (event.key !== key || (event.storageArea && event.storageArea !== getStorage())) return;
      setValue(event.newValue === null ? defaultValue : readStoredValue(key, defaultValue));
    }

    window.addEventListener('storage', syncFromAnotherTab);
    return () => window.removeEventListener('storage', syncFromAnotherTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Stable identity (useCallback, not a plain function) — callers that memoize around this
  // setter (e.g. AuthProvider's action functions) can trust it never changes across renders.
  const set = useCallback(
    (next: T) => {
      setValue(next);
      try {
        getStorage()?.setItem(key, JSON.stringify(next));
      } catch {
        // Storage can be unavailable (privacy mode) or full; in-memory state still works.
      }
    },
    [key],
  );

  return [value, set, isHydrated] as const;
}
