import { Prisma } from '@prisma/client';

import { prisma } from '@/server/db';

// Subset of backend/src/app/modules/members/repository.py needed by auth — the rest
// (reading progress/goal/streak, staff member-management CRUD) belongs to later phases.
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
): Promise<MemberWithRole> {
  return prisma.user.update({ where: { id: memberId }, data, include: MEMBER_INCLUDE });
}

export async function bumpTokenVersion(userId: string): Promise<MemberWithRole> {
  return prisma.user.update({
    where: { id: userId },
    data: { tokenVersion: { increment: 1 } },
    include: MEMBER_INCLUDE,
  });
}
