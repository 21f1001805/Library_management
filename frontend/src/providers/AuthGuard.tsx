'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

import { ROUTES } from '@/constants/routes';
import { useAuth, type Role } from '@/providers/AuthProvider';

// Next-compatible equivalents of src/app/router/guards.tsx's ProtectedRoute/RoleRoute —
// that file's <Navigate> (a react-router-dom component) has no Next equivalent, since
// Next's router only supports imperative navigation (useRouter().replace) from an effect,
// not a declarative redirect-during-render. proxy.ts already redirects server-side before
// the page ships; these are defense in depth for the moment auth state changes client-side
// (e.g. a token expiring) without a full navigation.
//
// Every check below waits for isAuthReady before redirecting. AuthProvider's session lives
// in localStorage, which useLocalStorageState can't read until after mount (see its
// isHydrated comment) — until then isAuthenticated is always false, real session or not. A
// guard that redirected on that transient false would send *every* fresh page load through a
// bogus sign-out bounce (through /login, then back to the role home) before the real state
// ever gets a chance to load — a real regression this file used to have.

export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, isAuthReady } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isAuthReady && !isAuthenticated) router.replace(ROUTES.LOGIN);
  }, [isAuthReady, isAuthenticated, router]);

  if (!isAuthReady || !isAuthenticated) return null;
  return children;
}

export function RequireRole({ allow, children }: { allow: Role[]; children: ReactNode }) {
  const { isAuthenticated, isAuthReady, role } = useAuth();
  const router = useRouter();
  const allowed = Boolean(role && allow.includes(role));

  useEffect(() => {
    if (!isAuthReady) return;
    if (!isAuthenticated) {
      router.replace(ROUTES.LOGIN);
    } else if (!allowed) {
      router.replace(ROUTES.DASHBOARD);
    }
  }, [isAuthReady, isAuthenticated, allowed, router]);

  if (!isAuthReady || !isAuthenticated || !allowed) return null;
  return children;
}

const ROLE_HOME: Partial<Record<Role, string>> = {
  admin: ROUTES.ADMIN,
  'it-head': ROUTES.IT_HEAD,
  guardian: ROUTES.GUARDIAN,
};

/**
 * Next-compatible equivalent of guards.tsx's PublicRoute — wraps login/register/forgot/reset
 * so that becoming authenticated *while already on one of those pages* (e.g. clicking a
 * dev-preview role button, or Login's own submit) redirects away immediately. proxy.ts only
 * re-evaluates on a fresh navigation/request, so it can't see a client-side auth-state change
 * that happens without one — this covers exactly that gap.
 */
export function RedirectIfAuthenticated({ children }: { children: ReactNode }) {
  const { isAuthenticated, isAuthReady, role, postAuthRedirect } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isAuthReady && isAuthenticated) {
      router.replace(postAuthRedirect ?? (role && ROLE_HOME[role]) ?? ROUTES.DASHBOARD);
    }
  }, [isAuthReady, isAuthenticated, role, postAuthRedirect, router]);

  // Before isAuthReady resolves we don't yet know the real session — render the form rather
  // than blank, since "signed out" is the far more common case and this avoids a flash of
  // nothing on every visit; the effect above redirects away a moment later on the rare case
  // this device turns out to already be signed in.
  if (isAuthReady && isAuthenticated) return null;
  return children;
}
