import { cookies } from 'next/headers';
import type { Prisma } from '@prisma/client';

import { prisma } from '@/server/db';
import { HttpError } from '@/server/http';
import { ACCESS_COOKIE } from '@/server/auth/cookies';
import { decodeToken } from '@/server/auth/security';

// Mirrors backend/src/app/api/deps.py: get_current_user/get_optional_user/require_role.
// No DI system in Route Handlers, so these are plain functions each handler calls
// explicitly at the top, rather than framework-injected dependencies.
export type AuthenticatedUser = Prisma.UserGetPayload<{ include: { role: true } }>;

function credentialsError(): HttpError {
  return new HttpError(401, 'Could not validate credentials');
}

function bearerToken(request: Request, cookieValue: string | undefined): string | null {
  // Authorization header first (tools/tests/Postman), the httpOnly access_token cookie
  // otherwise (the browser sends it automatically — see auth/cookies.ts).
  const header = request.headers.get('authorization');
  if (header?.startsWith('Bearer ')) return header.slice('Bearer '.length);
  return cookieValue ?? null;
}

async function resolveUser(request: Request): Promise<AuthenticatedUser | null> {
  const store = await cookies();
  const token = bearerToken(request, store.get(ACCESS_COOKIE)?.value);
  if (!token) return null;

  let claims;
  try {
    claims = decodeToken(token);
  } catch {
    return null;
  }
  if (claims.type !== 'access' || !claims.sub) return null;

  const user = await prisma.user.findUnique({ where: { id: claims.sub }, include: { role: true } });
  if (!user || user.deletedAt !== null || !user.isActive) return null;
  return user;
}

export async function getCurrentUser(request: Request): Promise<AuthenticatedUser> {
  const user = await resolveUser(request);
  if (!user) throw credentialsError();
  return user;
}

export async function getOptionalUser(request: Request): Promise<AuthenticatedUser | null> {
  return resolveUser(request);
}

export async function requireRole(
  request: Request,
  ...allowedRoles: string[]
): Promise<AuthenticatedUser> {
  const user = await getCurrentUser(request);
  if (!allowedRoles.includes(user.role.name)) {
    throw new HttpError(403, 'You do not have permission to perform this action');
  }
  return user;
}
