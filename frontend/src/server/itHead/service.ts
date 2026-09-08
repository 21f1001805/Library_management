import type { Loan, LoginActivity, AuditLogEntry, Payment, SupportTicket, User } from '@prisma/client';

import type { TrendOut } from '@/server/admin/schemas';
import { AuditAction } from '@/server/auditLog/constants';
import * as loansService from '@/server/loans/service';
import { FINE_PER_DAY } from '@/server/loans/constants';
import { calculateMembershipExpiry } from '@/server/payments/service';
import * as permissionRequestsRepository from '@/server/permissionRequests/repository';
import * as pricingPlansRepository from '@/server/pricingPlans/repository';
import * as supportTicketsRepository from '@/server/supportTickets/repository';
import * as repository from '@/server/itHead/repository';
import type { ActiveUserWithRole } from '@/server/itHead/repository';
import type {
  FeeCollectionMonthOut,
  FeeStatusEntryOut,
  ITHeadAlertOut,
  ITHeadDashboardOut,
  IssueResolutionMonthOut,
  RoleBreakdownEntryOut,
  SystemActivityDayOut,
} from '@/server/itHead/schemas';

// Mirrors backend/src/app/modules/it_head/service.py.

// A renewal grace period, not a book-loan one. Expired more recently than this shows as
// "due"; longer than this shows as "overdue".
const RENEWAL_GRACE_DAYS = 7;
const FEE_TREND_MONTHS = 6;
const ISSUE_TREND_MONTHS = 6;
const SYSTEM_ACTIVITY_DAYS = 7;
const OVERDUE_FINE_SPIKE_DAYS = 14;

const ACCESS_CHANGE_ACTIONS = [AuditAction.MEMBER_ROLE_CHANGED, AuditAction.MEMBER_ACTIVATION_CHANGED];
const PERMISSION_UPDATE_ACTIONS = [
  AuditAction.PERMISSION_REQUEST_GRANTED,
  AuditAction.PERMISSION_REQUEST_DENIED,
];

const DAY_MS = 24 * 60 * 60 * 1000;

function trend(current: number, previous: number): TrendOut {
  if (previous === 0) return { direction: 'up', percent: current > 0 ? 100 : 0 };
  const percent = Math.round((Math.abs(current - previous) / Math.abs(previous)) * 100);
  return { direction: current >= previous ? 'up' : 'down', percent };
}

function monthKey(moment: Date): string {
  return `${moment.getUTCFullYear().toString().padStart(4, '0')}-${(moment.getUTCMonth() + 1).toString().padStart(2, '0')}`;
}

function monthStart(moment: Date): Date {
  return new Date(Date.UTC(moment.getUTCFullYear(), moment.getUTCMonth(), 1));
}

function previousMonthStart(moment: Date): Date {
  return monthStart(new Date(monthStart(moment).getTime() - DAY_MS));
}

function recentMonthStarts(count: number, now: Date): Date[] {
  const starts: Date[] = [];
  let cursor = monthStart(now);
  for (let i = 0; i < count; i++) {
    starts.push(cursor);
    cursor = previousMonthStart(cursor);
  }
  return starts.reverse();
}

function todayStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function recentDayStarts(count: number, now: Date): Date[] {
  const today = todayStart(now);
  const starts: Date[] = [];
  for (let offset = count - 1; offset >= 0; offset--) {
    starts.push(new Date(today.getTime() - offset * DAY_MS));
  }
  return starts;
}

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Sum of the flat renewal price owed by every member not paid up, evaluated as of a
// specific instant — truncates each member's payment history to what existed by `asOf`
// before calling calculateMembershipExpiry, so a historical month's figure doesn't
// count a renewal that hadn't happened yet at that point in time.
function feeStatusAsOf(
  members: User[],
  paymentsByMember: Map<string, Payment[]>,
  renewalPrice: number,
  asOf: Date,
): number {
  let total = 0;
  for (const member of members) {
    if (member.createdAt > asOf) continue;
    const history = (paymentsByMember.get(member.id) ?? []).filter((p) => p.createdAt <= asOf);
    if (history.length === 0) {
      total += renewalPrice;
      continue;
    }
    const expiresAt = calculateMembershipExpiry(history);
    if (expiresAt === null || expiresAt <= asOf) total += renewalPrice;
  }
  return total;
}

function feeCollections(
  members: User[],
  paymentsByMember: Map<string, Payment[]>,
  membershipPayments: Payment[],
  renewalPrice: number,
  monthStarts: Date[],
  currentFeesOutstanding: number,
): FeeCollectionMonthOut[] {
  const collectedByMonth = new Map<string, number>();
  for (const payment of membershipPayments) {
    const key = monthKey(payment.createdAt);
    collectedByMonth.set(key, (collectedByMonth.get(key) ?? 0) + payment.amount);
  }

  return monthStarts.map((start, index) => {
    let pending: number;
    if (index + 1 < monthStarts.length) {
      pending = feeStatusAsOf(members, paymentsByMember, renewalPrice, monthStarts[index + 1]);
    } else {
      // The current (last) month has no "end" yet — reuse the real, already-computed
      // fees_outstanding rather than re-deriving "as of right now" a second time.
      pending = currentFeesOutstanding;
    }
    return { month: monthKey(start), collected: collectedByMonth.get(monthKey(start)) ?? 0, pending };
  });
}

function issueResolution(tickets: SupportTicket[], monthStarts: Date[]): IssueResolutionMonthOut[] {
  const buckets = new Map<string, Map<string, number>>();
  for (const ticket of tickets) {
    const key = monthKey(ticket.createdAt);
    const counter = buckets.get(key) ?? new Map<string, number>();
    counter.set(ticket.status, (counter.get(ticket.status) ?? 0) + 1);
    buckets.set(key, counter);
  }

  return monthStarts.map((start) => {
    const counts = buckets.get(monthKey(start)) ?? new Map<string, number>();
    return {
      month: monthKey(start),
      resolved: counts.get('resolved') ?? 0,
      open: counts.get('open') ?? 0,
      other: counts.get('closed') ?? 0,
    };
  });
}

function systemActivity(
  loginRows: LoginActivity[],
  accessChangeRows: AuditLogEntry[],
  permissionUpdateRows: AuditLogEntry[],
  dayStarts: Date[],
): SystemActivityDayOut[] {
  const loginsByDay = new Map<string, number>();
  for (const row of loginRows) {
    const key = dateKey(row.date);
    loginsByDay.set(key, (loginsByDay.get(key) ?? 0) + 1);
  }
  const accessByDay = new Map<string, number>();
  for (const row of accessChangeRows) {
    const key = dateKey(row.createdAt);
    accessByDay.set(key, (accessByDay.get(key) ?? 0) + 1);
  }
  const permissionsByDay = new Map<string, number>();
  for (const row of permissionUpdateRows) {
    const key = dateKey(row.createdAt);
    permissionsByDay.set(key, (permissionsByDay.get(key) ?? 0) + 1);
  }

  return dayStarts.map((start) => {
    const key = dateKey(start);
    return {
      date: key,
      logins: loginsByDay.get(key) ?? 0,
      access_changes: accessByDay.get(key) ?? 0,
      permissions_updated: permissionsByDay.get(key) ?? 0,
    };
  });
}

// Late-fee amount generated by loans whose due date falls in [start, end) — a flow, not
// the running balance sum_outstanding_fines() reports.
function finesGeneratedInRange(loans: Loan[], start: Date, end: Date): number {
  let total = 0;
  const now = new Date();
  for (const loan of loans) {
    if (!(loan.dueDate >= start && loan.dueDate < end)) continue;
    const endOfLoan = loan.returnedAt ?? now;
    const daysLate = Math.max(
      0,
      Math.round(
        (Date.UTC(endOfLoan.getUTCFullYear(), endOfLoan.getUTCMonth(), endOfLoan.getUTCDate()) -
          Date.UTC(loan.dueDate.getUTCFullYear(), loan.dueDate.getUTCMonth(), loan.dueDate.getUTCDate())) /
          DAY_MS,
      ),
    );
    total += daysLate * FINE_PER_DAY;
  }
  return total;
}

function accessByRole(users: ActiveUserWithRole[]): RoleBreakdownEntryOut[] {
  const counts = new Map<string, number>();
  for (const user of users) counts.set(user.role.name, (counts.get(user.role.name) ?? 0) + 1);
  const total = [...counts.values()].reduce((a, b) => a + b, 0) || 1;
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([role, count]) => ({ role, count, percent: Math.round((count / total) * 100) }));
}

function alerts(opts: {
  overdueFineSpike: number;
  pendingPermissions: number;
  openIssues: number;
  accessChangesToday: number;
}): ITHeadAlertOut[] {
  return [
    {
      id: 'overdue-fines',
      severity: opts.overdueFineSpike > 0 ? 'critical' : 'success',
      title: opts.overdueFineSpike > 0 ? 'Overdue Fines' : 'Fines Under Control',
      description:
        opts.overdueFineSpike > 0
          ? `${opts.overdueFineSpike} loan(s) overdue more than ${OVERDUE_FINE_SPIKE_DAYS} days.`
          : `No loans overdue beyond the ${OVERDUE_FINE_SPIKE_DAYS}-day grace window.`,
    },
    {
      id: 'pending-permissions',
      severity: opts.pendingPermissions > 0 ? 'warning' : 'success',
      title: opts.pendingPermissions > 0 ? 'Pending Permissions' : 'Permissions Up to Date',
      description:
        opts.pendingPermissions > 0
          ? `${opts.pendingPermissions} request(s) awaiting your review.`
          : 'No permission requests waiting on a decision.',
    },
    {
      id: 'open-issues',
      severity: opts.openIssues > 0 ? 'info' : 'success',
      title: opts.openIssues > 0 ? `${opts.openIssues} Open Issue(s)` : 'No Open Issues',
      description:
        opts.openIssues > 0
          ? 'Unresolved support tickets need attention.'
          : 'Every support ticket has been resolved or closed.',
    },
    {
      id: 'access-control',
      severity: 'success',
      title: 'Access Control',
      description:
        opts.accessChangesToday > 0
          ? `${opts.accessChangesToday} role/activation change(s) logged today.`
          : 'No role or activation changes logged today.',
    },
  ];
}

export async function getDashboard(): Promise<ITHeadDashboardOut> {
  const now = new Date();
  const feeMonthStarts = recentMonthStarts(FEE_TREND_MONTHS, now);
  const issueMonthStarts = recentMonthStarts(ISSUE_TREND_MONTHS, now);
  const dayStarts = recentDayStarts(SYSTEM_ACTIVITY_DAYS, now);
  const previousDayStarts = recentDayStarts(
    SYSTEM_ACTIVITY_DAYS,
    new Date(dayStarts[0].getTime() - DAY_MS),
  );
  const yesterdayStart =
    dayStarts.length > 1 ? dayStarts[dayStarts.length - 2] : new Date(dayStarts[0].getTime() - DAY_MS);

  const [
    activeMembers,
    openIssues,
    pendingPermissions,
    lateFinesOutstanding,
    members,
    paymentsByMember,
    plans,
    membershipPayments,
    ticketsSince,
    allActiveUsers,
    loginRows,
    accessChangeRows,
    permissionUpdateRows,
    overdueFineSpike,
    permissionRequestsRecent,
    loansDueRecent,
  ] = await Promise.all([
    repository.countActiveMembers(),
    supportTicketsRepository.countByStatus('open'),
    permissionRequestsRepository.countPending(),
    loansService.sumOutstandingFines(),
    repository.listActiveMembers(),
    repository.membershipPaymentsByMember(),
    pricingPlansRepository.listAll(),
    repository.listMembershipPayments(),
    repository.listSupportTicketsCreatedSince(issueMonthStarts[0]),
    repository.listActiveUsersWithRole(),
    repository.listLoginActivitySince(previousDayStarts[0]),
    repository.listAuditEntriesSince(ACCESS_CHANGE_ACTIONS, previousDayStarts[0]),
    repository.listAuditEntriesSince(PERMISSION_UPDATE_ACTIONS, previousDayStarts[0]),
    repository.countOverdueLoansBeyond(OVERDUE_FINE_SPIKE_DAYS, now),
    repository.listPermissionRequestsSince(feeMonthStarts[0]),
    repository.listLoansDueSince(previousMonthStart(now)),
  ]);

  const renewalPrice = plans.find((plan) => plan.planId === '1m')?.price ?? 0;

  const feeStatus: FeeStatusEntryOut[] = [];
  let feesOutstanding = 0;
  for (const member of members) {
    const memberPayments = paymentsByMember.get(member.id) ?? [];
    const payment = memberPayments.length > 0 ? memberPayments[memberPayments.length - 1] : null;
    if (!payment) {
      feeStatus.push({
        member_id: member.id,
        member_name: member.fullName,
        amount_due: renewalPrice,
        status: 'overdue',
        due_date: member.createdAt.toISOString(),
      });
      feesOutstanding += renewalPrice;
      continue;
    }

    let expiresAt = calculateMembershipExpiry(memberPayments);
    if (expiresAt === null) expiresAt = payment.createdAt;
    if (expiresAt > now) {
      feeStatus.push({
        member_id: member.id,
        member_name: member.fullName,
        amount_due: 0,
        status: 'paid',
        due_date: null,
      });
      continue;
    }

    const daysOverdue = Math.floor((now.getTime() - expiresAt.getTime()) / DAY_MS);
    const statusValue = daysOverdue > RENEWAL_GRACE_DAYS ? 'overdue' : 'due';
    feeStatus.push({
      member_id: member.id,
      member_name: member.fullName,
      amount_due: renewalPrice,
      status: statusValue,
      due_date: expiresAt.toISOString(),
    });
    feesOutstanding += renewalPrice;
  }

  const previousMonthStartValue = previousMonthStart(now);
  const activeMembersLastMonth = members.filter((m) => m.createdAt <= previousMonthStartValue).length;
  const feesOutstandingLastMonth = feeStatusAsOf(
    members,
    paymentsByMember,
    renewalPrice,
    previousMonthStartValue,
  );

  // A flow (fines newly generated in the window), not the running balance
  // lateFinesOutstanding reports.
  const finesGeneratedThisMonth = finesGeneratedInRange(loansDueRecent, monthStart(now), now);
  const finesGeneratedLastMonth = finesGeneratedInRange(
    loansDueRecent,
    previousMonthStartValue,
    monthStart(now),
  );

  const yesterdayEnd = new Date(yesterdayStart.getTime() + DAY_MS);
  const pendingPermissionsYesterday = permissionRequestsRecent.filter(
    (p) => p.createdAt < yesterdayEnd && (p.decidedAt === null || p.decidedAt >= yesterdayEnd),
  ).length;

  const feeCollectionsResult = feeCollections(
    members,
    paymentsByMember,
    membershipPayments,
    renewalPrice,
    feeMonthStarts,
    feesOutstanding,
  );
  const issueResolutionResult = issueResolution(ticketsSince, issueMonthStarts);
  const systemActivityResult = systemActivity(loginRows, accessChangeRows, permissionUpdateRows, dayStarts);
  const systemActivityPrevious = systemActivity(
    loginRows,
    accessChangeRows,
    permissionUpdateRows,
    previousDayStarts,
  );
  const accessByRoleResult = accessByRole(allActiveUsers);

  const loginsTotal = systemActivityResult.reduce((sum, d) => sum + d.logins, 0);
  const loginsPrevTotal = systemActivityPrevious.reduce((sum, d) => sum + d.logins, 0);
  const accessChangesTotal = systemActivityResult.reduce((sum, d) => sum + d.access_changes, 0);
  const accessChangesPrevTotal = systemActivityPrevious.reduce((sum, d) => sum + d.access_changes, 0);
  const permissionsUpdatedTotal = systemActivityResult.reduce((sum, d) => sum + d.permissions_updated, 0);
  const permissionsUpdatedPrevTotal = systemActivityPrevious.reduce(
    (sum, d) => sum + d.permissions_updated,
    0,
  );

  const openIssuesYesterday = ticketsSince.filter(
    (t) => t.status === 'open' && t.createdAt < new Date(yesterdayStart.getTime() + DAY_MS),
  ).length;

  return {
    stats: {
      active_members: activeMembers,
      active_members_trend: trend(activeMembers, activeMembersLastMonth),
      open_issues: openIssues,
      open_issues_delta: openIssues - openIssuesYesterday,
      pending_permissions: pendingPermissions,
      pending_permissions_delta: pendingPermissions - pendingPermissionsYesterday,
      fees_outstanding: feesOutstanding,
      fees_outstanding_trend: trend(feesOutstanding, feesOutstandingLastMonth),
      late_fines_outstanding: lateFinesOutstanding,
      late_fines_outstanding_trend: trend(finesGeneratedThisMonth, finesGeneratedLastMonth),
    },
    fee_status: feeStatus,
    fee_collections: feeCollectionsResult,
    issue_resolution: issueResolutionResult,
    system_activity: systemActivityResult,
    system_activity_summary: {
      logins_total: loginsTotal,
      logins_trend: trend(loginsTotal, loginsPrevTotal),
      access_changes_total: accessChangesTotal,
      access_changes_trend: trend(accessChangesTotal, accessChangesPrevTotal),
      permissions_updated_total: permissionsUpdatedTotal,
      permissions_updated_trend: trend(permissionsUpdatedTotal, permissionsUpdatedPrevTotal),
    },
    access_by_role: accessByRoleResult,
    alerts: alerts({
      overdueFineSpike: overdueFineSpike,
      pendingPermissions,
      openIssues,
      accessChangesToday:
        systemActivityResult.length > 0
          ? systemActivityResult[systemActivityResult.length - 1].access_changes
          : 0,
    }),
  };
}
