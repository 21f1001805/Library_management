import { Prisma, type ReadingGoal } from '@prisma/client';

import { prisma } from '@/server/db';
import { Role } from '@/server/constants';

// Mirrors backend/src/app/modules/members/repository.py in full.
const MEMBER_INCLUDE = { role: true } satisfies Prisma.UserInclude;

export type MemberWithRole = Prisma.UserGetPayload<{ include: typeof MEMBER_INCLUDE }>;

export async function upsertRole(name: string) {
  return prisma.role.upsert({
    where: { name },
    create: { name },
    update: {},
  });
}

export async function findById(memberId: string): Promise<MemberWithRole | null> {
  return prisma.user.findUnique({ where: { id: memberId }, include: MEMBER_INCLUDE });
}

export async function findByEmail(email: string): Promise<MemberWithRole | null> {
  return prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    include: MEMBER_INCLUDE,
  });
}

export async function touchLastLogin(userId: string): Promise<void> {
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  await prisma.user.update({ where: { id: userId }, data: { lastLoginAt: now } });
  try {
    await prisma.loginActivity.create({ data: { memberId: userId, date: today } });
  } catch (err) {
    // Concurrent successful logins may both try to create today's activity row. The
    // unique row already represents the desired result, so authentication must not
    // fail just because another request won that race.
    if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) throw err;
  }
}

export async function createMember(data: {
  email: string;
  passwordHash: string | null;
  fullName: string;
  phone: string | null;
  avatarUrl: string | null;
  roleId: string;
}): Promise<MemberWithRole> {
  return prisma.user.create({
    data: {
      email: data.email.trim().toLowerCase(),
      passwordHash: data.passwordHash,
      fullName: data.fullName,
      phone: data.phone,
      avatarUrl: data.avatarUrl,
      roleId: data.roleId,
    },
    include: MEMBER_INCLUDE,
  });
}

export async function updateMember(
  memberId: string,
  data: Prisma.UserUpdateInput,
  client: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<MemberWithRole> {
  return client.user.update({ where: { id: memberId }, data, include: MEMBER_INCLUDE });
}

export async function countActiveAdmins(client: Prisma.TransactionClient | typeof prisma = prisma): Promise<number> {
  return client.user.count({
    where: { isActive: true, deletedAt: null, role: { name: Role.ADMIN } },
  });
}

// Not routed through the shared paginate() helper (see db/pagination.ts) — its
// Paginatable<T> interface can't carry a typed `include`, only a bare model shape (fine
// for books/repository.ts's Book, which has none here). Same manual count+findMany as
// admin/repository.ts's own member listing, which hits the same include requirement.
export async function listMembers(opts: {
  search: string | null;
  page: number;
  pageSize: number;
  role: string | null;
  activeOnly: boolean;
}): Promise<[MemberWithRole[], number]> {
  const where: Prisma.UserWhereInput = { deletedAt: null };
  if (opts.activeOnly) where.isActive = true;
  if (opts.role) where.role = { name: opts.role };
  if (opts.search) {
    where.OR = [
      { fullName: { contains: opts.search, mode: 'insensitive' } },
      { email: { contains: opts.search, mode: 'insensitive' } },
    ];
  }

  const total = await prisma.user.count({ where });
  const items = await prisma.user.findMany({
    where,
    include: MEMBER_INCLUDE,
    orderBy: { createdAt: 'desc' },
    skip: (opts.page - 1) * opts.pageSize,
    take: opts.pageSize,
  });
  return [items, total];
}

export async function bumpTokenVersion(userId: string): Promise<MemberWithRole> {
  return prisma.user.update({
    where: { id: userId },
    data: { tokenVersion: { increment: 1 } },
    include: MEMBER_INCLUDE,
  });
}

const READING_PROGRESS_INCLUDE = { book: true } satisfies Prisma.ReadingProgressInclude;
export type ReadingProgressWithBook = Prisma.ReadingProgressGetPayload<{
  include: typeof READING_PROGRESS_INCLUDE;
}>;

export async function listReadingProgress(memberId: string): Promise<ReadingProgressWithBook[]> {
  return prisma.readingProgress.findMany({
    where: { memberId },
    include: READING_PROGRESS_INCLUDE,
    orderBy: { updatedAt: 'desc' },
  });
}

export async function upsertReadingProgress(opts: {
  memberId: string;
  bookId: string;
  status: string;
  percentComplete: number;
}): Promise<ReadingProgressWithBook> {
  return prisma.readingProgress.upsert({
    where: { memberId_bookId: { memberId: opts.memberId, bookId: opts.bookId } },
    create: {
      memberId: opts.memberId,
      bookId: opts.bookId,
      status: opts.status,
      percentComplete: opts.percentComplete,
    },
    update: { status: opts.status, percentComplete: opts.percentComplete },
    include: READING_PROGRESS_INCLUDE,
  });
}

export async function getReadingGoal(memberId: string): Promise<ReadingGoal | null> {
  return prisma.readingGoal.findUnique({ where: { memberId } });
}

export async function upsertReadingGoal(opts: {
  memberId: string;
  yearlyGoal: number;
  monthlyGoal: number;
}): Promise<ReadingGoal> {
  return prisma.readingGoal.upsert({
    where: { memberId: opts.memberId },
    create: { memberId: opts.memberId, yearlyGoal: opts.yearlyGoal, monthlyGoal: opts.monthlyGoal },
    update: { yearlyGoal: opts.yearlyGoal, monthlyGoal: opts.monthlyGoal },
  });
}

export async function countCompletedReadingProgress(memberId: string, since: Date): Promise<number> {
  return prisma.readingProgress.count({
    where: { memberId, status: 'completed', updatedAt: { gte: since } },
  });
}

export async function listLoginActivity(memberId: string): Promise<{ date: Date }[]> {
  return prisma.loginActivity.findMany({
    where: { memberId },
    orderBy: { date: 'desc' },
    select: { date: true },
  });
}
