import { z } from 'zod';
import type { ReadingGoal } from '@prisma/client';

import { Role } from '@/server/constants';
import type { MemberWithRole, ReadingProgressWithBook } from '@/server/members/repository';

// Mirrors backend/src/app/modules/members/schemas.py in full.

export const memberCreateSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  full_name: z.string().min(1).max(150),
  phone: z.string().max(20).nullable().optional(),
  avatar_url: z.string().nullable().optional(),
  role_name: z.nativeEnum(Role).default(Role.MEMBER),
});
export type MemberCreateInput = z.infer<typeof memberCreateSchema>;

export const memberUpdateSchema = z.object({
  full_name: z.string().min(1).max(150).nullable().optional(),
  phone: z.string().max(20).nullable().optional(),
  avatar_url: z.string().nullable().optional(),
  is_active: z.boolean().nullable().optional(),
  role_name: z.nativeEnum(Role).nullable().optional(),
});
export type MemberUpdateInput = z.infer<typeof memberUpdateSchema>;

// same field names/shape (snake_case, ISO datetime strings) as FastAPI's Pydantic JSON
// serialization, so existing frontend consumers (lib/api.ts's AuthUser) keep parsing the
// response the same way regardless of which backend answered.
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

export interface ReadingProgressOut {
  id: string;
  book_id: string;
  book_title: string;
  status: string;
  percent_complete: number;
  updated_at: string;
}

export function readingProgressToJson(progress: ReadingProgressWithBook): ReadingProgressOut {
  return {
    id: progress.id,
    book_id: progress.bookId,
    book_title: progress.book.title,
    status: progress.status,
    percent_complete: progress.percentComplete,
    updated_at: progress.updatedAt.toISOString(),
  };
}

export interface MemberListResponse {
  items: MemberOut[];
  total: number;
  page: number;
  page_size: number;
}

export const readingProgressUpsertSchema = z.object({
  book_id: z.string(),
  status: z.enum(['reading', 'completed']).default('reading'),
  percent_complete: z.number().int().min(0).max(100).default(0),
});
export type ReadingProgressUpsertInput = z.infer<typeof readingProgressUpsertSchema>;

export const readingGoalUpsertSchema = z.object({
  yearly_goal: z.number().int().gt(0).max(1000),
  monthly_goal: z.number().int().gt(0).max(1000),
});
export type ReadingGoalUpsertInput = z.infer<typeof readingGoalUpsertSchema>;

export interface ReadingGoalOut {
  yearly_goal: number;
  monthly_goal: number;
  books_completed_this_year: number;
  books_completed_this_month: number;
  updated_at: string;
}

export function readingGoalToJson(
  goal: ReadingGoal,
  opts: { completedThisYear: number; completedThisMonth: number },
): ReadingGoalOut {
  return {
    yearly_goal: goal.yearlyGoal,
    monthly_goal: goal.monthlyGoal,
    books_completed_this_year: opts.completedThisYear,
    books_completed_this_month: opts.completedThisMonth,
    updated_at: goal.updatedAt.toISOString(),
  };
}

export interface ReadingStreakOut {
  current_streak_days: number;
  longest_streak_days: number;
}

export interface ReadingProfileOut {
  interests: string[];
  difficulty: string;
  preference: string;
  insight: string;
}
