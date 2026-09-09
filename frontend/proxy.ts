import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Server-side mirror of src/app/router/guards.tsx's ProtectedRoute/PublicRoute/RoleRoute —
// runs before the page ships, so a logged-out visit to a protected route never flashes
// protected content. It reads only the non-httpOnly `is_logged_in`/`session_role` cookies
// (see backend/src/app/core/cookies.py) — never the real access/refresh tokens — so this
// is a fast presence/role check, not the security boundary; the backend still verifies the
// real JWT on every request. The client-side guards stay in place too as defense in depth
// once those routes are ported here.

const PUBLIC_AUTH_PATHS = ['/login', '/register', '/forgot-password', '/reset-password'];

const ROLE_GATED_PREFIXES: { prefix: string; roles: string[] }[] = [
  { prefix: '/admin', roles: ['admin'] },
  { prefix: '/it-head', roles: ['it-head'] },
  { prefix: '/guardian', roles: ['guardian'] },
  { prefix: '/manager', roles: ['manager', 'librarian'] },
];

// Needs *any* authenticated session, no specific role — mirrors AppRouter.tsx's
// ProtectedRoute-wrapped UserLayout tree.
const AUTHENTICATED_PREFIXES = [
  '/dashboard',
  '/books',
  '/borrow-history',
  '/reservations',
  '/seat-booking',
  '/payment',
  '/community',
  '/events',
  '/profile',
  '/reading-progress',
  '/leaderboard',
  '/reviews',
  '/support',
  '/settings',
];

const ROLE_HOME: Record<string, string> = {
  admin: '/admin',
  'it-head': '/it-head',
  guardian: '/guardian',
};

function roleHome(role: string | undefined): string {
  return (role && ROLE_HOME[role]) || '/dashboard';
}

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isLoggedIn = request.cookies.get('is_logged_in')?.value === '1';
  const role = request.cookies.get('session_role')?.value;

  if (PUBLIC_AUTH_PATHS.includes(pathname)) {
    if (isLoggedIn) {
      return NextResponse.redirect(new URL(roleHome(role), request.url));
    }
    return NextResponse.next();
  }

  const roleGate = ROLE_GATED_PREFIXES.find((gate) => matchesPrefix(pathname, gate.prefix));
  if (roleGate) {
    if (!isLoggedIn) return NextResponse.redirect(new URL('/login', request.url));
    if (!role || !roleGate.roles.includes(role)) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.next();
  }

  const needsAuth = AUTHENTICATED_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
  if (needsAuth && !isLoggedIn) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Everything except Next internals, the favicon, and static-file requests (anything
    // with a dot in the last path segment, e.g. /books/1.jpg from public/) — without the
    // `.*\..*` exclusion, a static asset under a path that also happens to be a protected
    // page prefix (e.g. /books/*.jpg vs the /books catalog route) gets redirected to
    // /login for a logged-out visitor instead of being served.
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)',
  ],
};
