const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';
const API_PREFIX = import.meta.env.VITE_API_PREFIX ?? '/api/v1';

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
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    if (response.status === 401 && token && !isRetry && refreshHandler) {
      const newToken = await refreshHandler();
      if (newToken) return apiRequest<T>(method, path, body, newToken, true);
    }
    const detail = await response.json().catch(() => null);
    throw new ApiError(response.status, detail?.detail ?? 'Request failed');
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
