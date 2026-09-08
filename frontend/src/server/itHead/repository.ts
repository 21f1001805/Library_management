import type {
  AuditLogEntry,
  Loan,
  LoginActivity,
  Payment,
  PermissionRequest,
  Prisma,
  SupportTicket,
  User,
} from '@prisma/client';

import { prisma } from '@/server/db';
import { Role } from '@/server/constants';

// Mirrors backend/src/app/modules/it_head/repository.py.
export async function countActiveMembers(): Promise<number> {
  return prisma.user.count({ where: { role: { name: Role.MEMBER }, deletedAt: null, isActive: true } });
}

export async function listActiveMembers(): Promise<User[]> {
  return prisma.user.findMany({ where: { role: { name: Role.MEMBER }, deletedAt: null, isActive: true } });
}

// Every non-deleted, active user across all roles — for the role breakdown donut,
// unlike listActiveMembers() which is scoped to Role.MEMBER only.
const ACTIVE_USER_WITH_ROLE_INCLUDE = { role: true } satisfies Prisma.UserInclude;
export type ActiveUserWithRole = Prisma.UserGetPayload<{ include: typeof ACTIVE_USER_WITH_ROLE_INCLUDE }>;

export async function listActiveUsersWithRole(): Promise<ActiveUserWithRole[]> {
  return prisma.user.findMany({
    where: { deletedAt: null, isActive: true },
    include: ACTIVE_USER_WITH_ROLE_INCLUDE,
  });
}

// Active (unreturned) loans whose due date is more than thresholdDays in the past.
export async function countOverdueLoansBeyond(thresholdDays: number, now: Date): Promise<number> {
  const cutoff = new Date(now.getTime() - thresholdDays * 24 * 60 * 60 * 1000);
  return prisma.loan.count({ where: { returnedAt: null, dueDate: { lt: cutoff } } });
}

export async function countAuditActionsBetween(
  actions: string[],
  start: Date,
  end: Date,
): Promise<number> {
  return prisma.auditLogEntry.count({ where: { action: { in: actions }, createdAt: { gte: start, lt: end } } });
}

export async function listAuditEntriesSince(actions: string[], start: Date): Promise<AuditLogEntry[]> {
  return prisma.auditLogEntry.findMany({ where: { action: { in: actions }, createdAt: { gte: start } } });
}

// One row per (member, calendar day) they logged in — so counting rows per day already
// gives distinct logins/day.
export async function listLoginActivitySince(start: Date): Promise<LoginActivity[]> {
  return prisma.loginActivity.findMany({ where: { date: { gte: start } } });
}

export async function listSupportTicketsCreatedSince(start: Date): Promise<SupportTicket[]> {
  return prisma.supportTicket.findMany({ where: { createdAt: { gte: start } } });
}

export async function listPermissionRequestsSince(start: Date): Promise<PermissionRequest[]> {
  return prisma.permissionRequest.findMany({ where: { createdAt: { gte: start } } });
}

export async function listLoansDueSince(start: Date): Promise<Loan[]> {
  return prisma.loan.findMany({ where: { dueDate: { gte: start } } });
}

export async function listMembershipPayments(): Promise<Payment[]> {
  return prisma.payment.findMany({
    where: { status: 'success', planMonths: { not: null } },
    orderBy: { createdAt: 'desc' },
  });
}

// All successful plan payments per member, oldest first — matches the ordering
// calculateMembershipExpiry expects.
export async function membershipPaymentsByMember(): Promise<Map<string, Payment[]>> {
  const payments = await prisma.payment.findMany({
    where: { status: 'success', planMonths: { not: null } },
    orderBy: { createdAt: 'asc' },
  });
  const grouped = new Map<string, Payment[]>();
  for (const payment of payments) {
    const list = grouped.get(payment.userId) ?? [];
    list.push(payment);
    grouped.set(payment.userId, list);
  }
  return grouped;
}
