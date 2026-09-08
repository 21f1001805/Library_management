import { Prisma, type ReadingGoal } from '@prisma/client';

import { prisma } from '@/server/db';
import { HttpError } from '@/server/http';
import { Role } from '@/server/constants';
import { hashPassword } from '@/server/auth/security';
import * as auditLogService from '@/server/auditLog/service';
import { AuditAction } from '@/server/auditLog/constants';
import * as readingProfile from '@/server/members/readingProfile';
import * as repository from '@/server/members/repository';
import {
  memberToJson,
  readingGoalToJson,
  readingProgressToJson,
  type MemberCreateInput,
  type MemberListResponse,
  type MemberOut,
  type MemberUpdateInput,
  type ReadingGoalOut,
  type ReadingGoalUpsertInput,
  type ReadingProfileOut,
  type ReadingProgressOut,
  type ReadingProgressUpsertInput,
  type ReadingStreakOut,
} from '@/server/members/schemas';

// Mirrors backend/src/app/modules/members/service.py in full.

// Constant key: this gates the "is this the last admin" decision globally, not per row.
const ADMIN_COUNT_LOCK = 'members:active-admin-count';

export async function listMembers(opts: {
  search: string | null;
  page: number;
  pageSize: number;
  role: string | null;
  activeOnly: boolean;
}): Promise<MemberListResponse> {
  const [items, total] = await repository.listMembers(opts);
  return {
    items: items.map(memberToJson),
    total,
    page: opts.page,
    page_size: opts.pageSize,
  };
}

export async function createMember(payload: MemberCreateInput): Promise<MemberOut> {
  const role = await repository.upsertRole(payload.role_name);

  let user;
  try {
    user = await repository.createMember({
      email: payload.email,
      passwordHash: await hashPassword(payload.password),
      fullName: payload.full_name,
      phone: payload.phone ?? null,
      avatarUrl: payload.avatar_url ?? null,
      roleId: role.id,
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new HttpError(409, 'A member with this email already exists');
    }
    throw err;
  }

  return memberToJson(user);
}

export async function updateMember(
  memberId: string,
  payload: MemberUpdateInput,
  actorId: string,
): Promise<MemberOut> {
  const existing = await repository.findById(memberId);
  if (!existing || existing.deletedAt !== null) throw new HttpError(404, 'Member not found');

  const removesAdminAccess =
    payload.is_active === false || (payload.role_name != null && payload.role_name !== Role.ADMIN);
  if (memberId === actorId && removesAdminAccess) {
    throw new HttpError(409, 'You cannot deactivate or remove your own admin access');
  }
  const guardsLastAdmin = existing.role.name === Role.ADMIN && removesAdminAccess;

  const data: Prisma.UserUpdateInput = {};
  if (payload.full_name !== undefined && payload.full_name !== null) data.fullName = payload.full_name;
  if ('phone' in payload) data.phone = payload.phone ?? null;
  if ('avatar_url' in payload) data.avatarUrl = payload.avatar_url ?? null;
  if (payload.is_active !== undefined && payload.is_active !== null) data.isActive = payload.is_active;
  let newRole: { id: string; name: string } | null = null;
  if (payload.role_name != null) {
    newRole = await repository.upsertRole(payload.role_name);
    data.role = { connect: { id: newRole.id } };
  }

  if (Object.keys(data).length === 0) return memberToJson(existing);

  let updated;
  if (guardsLastAdmin) {
    // Count and write inside one transaction, behind an advisory lock on a constant key.
    // pg_advisory_xact_lock is transaction-scoped, so taking it outside a transaction
    // would release it immediately and guard nothing. Without this, two concurrent
    // requests demoting two different admins both read a count of 2, both passed, and
    // both committed — leaving zero active admins.
    updated = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${ADMIN_COUNT_LOCK}))`;
      if ((await repository.countActiveAdmins(tx)) <= 1) {
        throw new HttpError(409, 'The last active admin cannot be deactivated or reassigned');
      }
      return repository.updateMember(memberId, data, tx);
    });
  } else {
    updated = await repository.updateMember(memberId, data);
  }

  // Recorded after the write succeeds, so the log never claims a change that failed.
  if (newRole && newRole.name !== existing.role.name) {
    await auditLogService.record({
      actorId,
      action: AuditAction.MEMBER_ROLE_CHANGED,
      metadata: { memberId, memberEmail: existing.email, from: existing.role.name, to: newRole.name },
    });
  }
  if (payload.is_active != null && payload.is_active !== existing.isActive) {
    await auditLogService.record({
      actorId,
      action: AuditAction.MEMBER_ACTIVATION_CHANGED,
      metadata: { memberId, memberEmail: existing.email, isActive: payload.is_active },
    });
  }
  return memberToJson(updated);
}

export async function listReadingProgress(memberId: string): Promise<ReadingProgressOut[]> {
  const items = await repository.listReadingProgress(memberId);
  return items.map(readingProgressToJson);
}

export async function recordReadingProgress(
  memberId: string,
  payload: ReadingProgressUpsertInput,
): Promise<ReadingProgressOut> {
  let progress;
  try {
    progress = await repository.upsertReadingProgress({
      memberId,
      bookId: payload.book_id,
      status: payload.status,
      percentComplete: payload.percent_complete,
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
      throw new HttpError(404, 'Book not found');
    }
    throw err;
  }
  return readingProgressToJson(progress);
}

async function buildReadingGoalOut(memberId: string, goal: ReadingGoal): Promise<ReadingGoalOut> {
  // ponytail: "completed this year/month" uses ReadingProgress.updatedAt as a proxy for
  // completion date (no separate completedAt column) — good enough until Loan/borrow
  // history exists to derive a real completion timestamp.
  const now = new Date();
  const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const completedThisYear = await repository.countCompletedReadingProgress(memberId, yearStart);
  const completedThisMonth = await repository.countCompletedReadingProgress(memberId, monthStart);

  return readingGoalToJson(goal, { completedThisYear, completedThisMonth });
}

export async function getReadingGoal(memberId: string): Promise<ReadingGoalOut | null> {
  const goal = await repository.getReadingGoal(memberId);
  if (!goal) return null;
  return buildReadingGoalOut(memberId, goal);
}

export async function upsertReadingGoal(memberId: string, payload: ReadingGoalUpsertInput): Promise<ReadingGoalOut> {
  const goal = await repository.upsertReadingGoal({
    memberId,
    yearlyGoal: payload.yearly_goal,
    monthlyGoal: payload.monthly_goal,
  });
  return buildReadingGoalOut(memberId, goal);
}

export async function getReadingStreak(memberId: string): Promise<ReadingStreakOut> {
  const rows = await repository.listLoginActivity(memberId);
  const loginDates = new Set(rows.map((row) => row.date.toISOString().slice(0, 10)));
  const [current, longest] = computeStreaks(loginDates);
  return { current_streak_days: current, longest_streak_days: longest };
}

export async function getReadingProfile(user: {
  id: string;
  readingProfile: unknown;
  readingProfileActivityCount: number | null;
}): Promise<ReadingProfileOut | null> {
  return readingProfile.ensureReadingProfile(user);
}

function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  return toDateKey(new Date(Date.UTC(y, m - 1, d + days)));
}

// Returns [currentStreak, longestStreak]. loginDates are calendar-date keys ("YYYY-MM-DD").
export function computeStreaks(loginDates: Set<string>): [number, number] {
  if (loginDates.size === 0) return [0, 0];

  const today = toDateKey(new Date());

  // Current streak counts backward from the most recent login day. If that's today or
  // yesterday the streak is still "alive" (grace period for not having logged in yet
  // today); anything older than that means the streak is broken.
  let cursor = loginDates.has(today) ? today : addDays(today, -1);
  let current = 0;
  while (loginDates.has(cursor)) {
    current += 1;
    cursor = addDays(cursor, -1);
  }

  let longest = 0;
  let run = 0;
  for (const day of [...loginDates].sort()) {
    run = loginDates.has(addDays(day, -1)) ? run + 1 : 1;
    longest = Math.max(longest, run);
  }

  return [current, longest];
}
