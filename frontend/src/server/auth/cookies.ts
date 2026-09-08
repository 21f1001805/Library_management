import { cookies } from 'next/headers';

import { env } from '@/server/env';
import { ACCESS_TOKEN_EXPIRE_SECONDS, REFRESH_TOKEN_EXPIRE_SECONDS } from '@/server/auth/security';

// Mirrors backend/src/app/core/cookies.py exactly — same names/paths/flags — so either
// backend's cookies are readable by the other during the module-by-module cutover.
export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'refresh_token';
export const SESSION_COOKIE = 'is_logged_in';
export const ROLE_COOKIE = 'session_role';
export const REFRESH_COOKIE_PATH = '/api/v1/auth';

export async function setAuthCookies(opts: {
  accessToken: string;
  refreshToken: string;
  role: string;
}): Promise<void> {
  const store = await cookies();
  const secure = env.APP_ENV === 'production';

  store.set(ACCESS_COOKIE, opts.accessToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    maxAge: ACCESS_TOKEN_EXPIRE_SECONDS,
    path: '/',
  });
  store.set(REFRESH_COOKIE, opts.refreshToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    maxAge: REFRESH_TOKEN_EXPIRE_SECONDS,
    path: REFRESH_COOKIE_PATH,
  });
  store.set(SESSION_COOKIE, '1', {
    httpOnly: false,
    secure,
    sameSite: 'lax',
    maxAge: REFRESH_TOKEN_EXPIRE_SECONDS,
    path: '/',
  });
  store.set(ROLE_COOKIE, opts.role, {
    httpOnly: false,
    secure,
    sameSite: 'lax',
    maxAge: REFRESH_TOKEN_EXPIRE_SECONDS,
    path: '/',
  });
}

export async function clearAuthCookies(): Promise<void> {
  const store = await cookies();
  const secure = env.APP_ENV === 'production';
  const expire = (name: string, path: string) =>
    store.set(name, '', { httpOnly: true, secure, sameSite: 'lax', maxAge: 0, path });

  expire(ACCESS_COOKIE, '/');
  expire(REFRESH_COOKIE, REFRESH_COOKIE_PATH);
  expire(SESSION_COOKIE, '/');
  expire(ROLE_COOKIE, '/');
}
