// Relative by default — the backend lives in this same Next.js app (app/api/v1/...), so
// no origin is needed. Set NEXT_PUBLIC_API_URL only to point at a different origin
// serving the same /api/v1 routes (e.g. a separately-deployed instance).
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';
const API_PREFIX = process.env.NEXT_PUBLIC_API_PREFIX ?? '/api/v1';

export function apiUrl(path: string): string {
  return `${API_URL}${API_PREFIX}${path}`;
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  role: { id: string; name: string };
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: AuthUser;
  is_new_user: boolean;
}

// The access token is short-lived (15 min) by design — AuthProvider registers a handler
// here so any authenticated request that comes back 401 gets one silent retry against a
// fresh access token before giving up. api.ts has no React context of its own, so this
// module-level slot is how AuthProvider hands it a way to refresh itself.
type RefreshHandler = () => Promise<string | null>;
let refreshHandler: RefreshHandler | null = null;

export function registerRefreshHandler(handler: RefreshHandler | null) {
  refreshHandler = handler;
}

async function apiRequest<T>(
  method: string,
  path: string,
  body: unknown,
  token?: string,
  isRetry = false,
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_URL}${API_PREFIX}${path}`, {
    method,
    headers,
    // Sends/receives the httpOnly access_token/refresh_token cookies the backend sets on
    // login/refresh. Same-origin, so browsers would send them either way — kept explicit
    // for the NEXT_PUBLIC_API_URL override path, where a request to a different origin is
    // genuinely cross-origin. The
    // bearer `token` argument above still works as a fallback/override (Authorization takes
    // priority server-side), so nothing else in this file or its ~110 call sites in
    // AuthProvider needs to change.
    credentials: 'include',
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    if (response.status === 401 && token && !isRetry && refreshHandler) {
      const newToken = await refreshHandler();
      if (newToken) return apiRequest<T>(method, path, body, newToken, true);
    }
    const errorBody = await response.json().catch(() => null);
    const raw = errorBody?.detail;
    // detail is a string for a plain HTTPException, an array of {msg, ...} for FastAPI's
    // 422 validation errors — stringifying the array is what used to show up in toasts.
    let message = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0]?.msg : null;

    // Rate-limit rejections come from slowapi, not FastAPI, and use {"error": "..."}
    // instead of {"detail": "..."} — so they used to fall through to "Request failed"
    // and a user who had simply tried to sign in too quickly was told nothing useful.
    if (message === null && response.status === 429) {
      message = 'Too many attempts. Please wait a minute and try again.';
    }

    throw new ApiError(response.status, message ?? 'Request failed');
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function apiGet<T>(path: string, token?: string): Promise<T> {
  return apiRequest<T>('GET', path, undefined, token);
}

export function apiPost<T>(path: string, body: unknown, token?: string): Promise<T> {
  return apiRequest<T>('POST', path, body, token);
}

export function apiPatch<T>(path: string, body: unknown, token: string): Promise<T> {
  return apiRequest<T>('PATCH', path, body, token);
}

export function apiPut<T>(path: string, body: unknown, token: string): Promise<T> {
  return apiRequest<T>('PUT', path, body, token);
}

export function apiDelete<T>(path: string, token: string): Promise<T> {
  return apiRequest<T>('DELETE', path, undefined, token);
}

export function getErrorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}
