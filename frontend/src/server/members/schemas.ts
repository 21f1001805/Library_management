import type { MemberWithRole } from '@/server/members/repository';

// Mirrors backend/src/app/modules/members/schemas.py's MemberOut — same field names/
// shape (snake_case, ISO datetime strings) as FastAPI's Pydantic JSON serialization, so
// existing frontend consumers (lib/api.ts's AuthUser) keep parsing the response the same
// way regardless of which backend answered.
export interface MemberOut {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  role: { id: string; name: string };
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export function memberToJson(user: MemberWithRole): MemberOut {
  return {
    id: user.id,
    email: user.email,
    full_name: user.fullName,
    phone: user.phone,
    avatar_url: user.avatarUrl,
    role: { id: user.role.id, name: user.role.name },
    is_active: user.isActive,
    last_login_at: user.lastLoginAt?.toISOString() ?? null,
    created_at: user.createdAt.toISOString(),
    updated_at: user.updatedAt.toISOString(),
  };
}
