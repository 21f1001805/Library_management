import { AuditAction } from '@/server/auditLog/constants';
import * as auditLogService from '@/server/auditLog/service';
import * as notificationsService from '@/server/notifications/service';
import { calculateMembershipExpiry } from '@/server/payments/service';
import { SEAT_LABELS } from '@/server/seatBooking/constants';
import * as repository from '@/server/admin/repository';
import { EXPENSE_BUDGETS, ExpenseCategory, OPEN_HOURS } from '@/server/admin/constants';
import {
  expenseToJson,
  type AdminDashboardOut,
  type AdminMemberListOut,
  type AdminMemberOut,
  type AdminPaymentListOut,
  type AdminPaymentOut,
  type AnnouncementCreateInput,
  type AnnouncementOut,
  type ExpenseBreakdownOut,
  type ExpenseCreateInput,
  type ExpenseOut,
  type MembershipGrowthOut,
  type ProfitAndLossOut,
  type RevenueByPlanOut,
  type TrendOut,
} from '@/server/admin/schemas';

// Mirrors backend/src/app/modules/admin/service.py.
const TOTAL_SEATS = SEAT_LABELS.length;
const REPORT_MONTHS = 6;

function monthStart(moment: Date): Date {
  return new Date(Date.UTC(moment.getUTCFullYear(), moment.getUTCMonth(), 1));
}

function previousMonthStart(moment: Date): Date {
  const lastDayOfPreviousMonth = new Date(monthStart(moment).getTime() - 24 * 60 * 60 * 1000);
  return monthStart(lastDayOfPreviousMonth);
}

function trend(current: number, previous: number): TrendOut {
  if (previous === 0) {
    return { direction: 'up', percent: current > 0 ? 100 : 0 };
  }
  // abs() on the divisor too: net profit is the one figure here that can be negative,
  // and dividing by a signed baseline made a shrinking loss render as "up -50%".
  const percent = Math.round((Math.abs(current - previous) / Math.abs(previous)) * 100);
  return { direction: current >= previous ? 'up' : 'down', percent };
}

function monthKey(moment: Date): string {
  return `${moment.getUTCFullYear().toString().padStart(4, '0')}-${(moment.getUTCMonth() + 1).toString().padStart(2, '0')}`;
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

function parseMonthRange(month: string): [Date, Date] {
  const [year, monthNum] = month.split('-').map(Number);
  const start = new Date(Date.UTC(year, monthNum - 1, 1));
  const end =
    monthNum === 12 ? new Date(Date.UTC(year + 1, 0, 1)) : new Date(Date.UTC(year, monthNum, 1));
  return [start, end];
}

export async function getDashboard(): Promise<AdminDashboardOut> {
  const utcNow = new Date();
  const thisMonthStart = monthStart(utcNow);
  const lastMonthStart = previousMonthStart(utcNow);

  const today = new Date(Date.UTC(utcNow.getUTCFullYear(), utcNow.getUTCMonth(), utcNow.getUTCDate()));
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

  // These are independent, so they run concurrently rather than as ~11 sequential round
  // trips. (The Python version also issues a sum_expenses(start=this_month_start) call
  // here whose result it never reads — expenses_mtd comes from spend_by_category
  // instead — dropped here rather than replicating a wasted query.)
  const [
    revenueMtd,
    revenueLastMonth,
    membershipFees,
    finesCollected,
    expensesLastMonth,
    totalMembers,
    totalMembersLastMonth,
    bookedThisHour,
    spendByCategory,
    bookingsByHour,
  ] = await Promise.all([
    repository.sumPayments({ start: thisMonthStart }),
    repository.sumPayments({ start: lastMonthStart, end: thisMonthStart }),
    repository.sumPayments({ start: thisMonthStart, hasPlan: true }),
    repository.sumPayments({ start: thisMonthStart, hasPlan: false }),
    repository.sumExpenses({ start: lastMonthStart, end: thisMonthStart }),
    repository.countMembers(),
    repository.countMembers(thisMonthStart),
    repository.countSeatBookings(today, utcNow.getUTCHours()),
    repository.sumExpensesByCategory(thisMonthStart),
    repository.countSeatBookingsByHour(yesterday),
  ]);

  const expensesMtd = [...spendByCategory.values()].reduce((a, b) => a + b, 0);
  const netProfitMtd = revenueMtd - expensesMtd;
  const netProfitLastMonth = revenueLastMonth - expensesLastMonth;

  const budget = Object.entries(EXPENSE_BUDGETS).map(([category, budgeted]) => ({
    category,
    budgeted,
    spent: spendByCategory.get(category) ?? 0,
  }));

  const seatStatus = {
    available: TOTAL_SEATS - bookedThisHour,
    booked: bookedThisHour,
    total: TOTAL_SEATS,
  };

  const seatOccupancy = OPEN_HOURS.map((hour) => ({
    hour,
    percent_filled: Math.round(((bookingsByHour.get(hour) ?? 0) / TOTAL_SEATS) * 100),
  }));

  return {
    stats: {
      revenue_mtd: revenueMtd,
      revenue_trend: trend(revenueMtd, revenueLastMonth),
      expenses_mtd: expensesMtd,
      expenses_trend: trend(expensesMtd, expensesLastMonth),
      net_profit_mtd: netProfitMtd,
      net_profit_trend: trend(netProfitMtd, netProfitLastMonth),
      total_members: totalMembers,
      total_members_trend: trend(totalMembers, totalMembersLastMonth),
    },
    cash_flow: [
      { source: 'membershipFees', amount: membershipFees },
      { source: 'eventTickets', amount: 0 },
      { source: 'finesCollected', amount: finesCollected },
      { source: 'donationsValue', amount: 0 },
    ],
    budget,
    seat_status: seatStatus,
    seat_occupancy: seatOccupancy,
  };
}

export async function logExpense(userId: string, payload: ExpenseCreateInput): Promise<ExpenseOut> {
  const expense = await repository.createExpense({
    category: payload.category,
    amount: payload.amount,
    loggedById: userId,
  });
  await auditLogService.record({
    actorId: userId,
    action: AuditAction.EXPENSE_LOGGED,
    metadata: { category: payload.category, amount: payload.amount },
  });
  return expenseToJson(expense);
}

export async function getRevenueByPlan(): Promise<RevenueByPlanOut> {
  const rows = await repository.revenueByPlanLabel();
  const items = rows.map((row) => ({
    label: row.label,
    amount: Number(row.amount),
    count: Number(row.count),
  }));
  return { items, total: items.reduce((sum, item) => sum + item.amount, 0) };
}

export async function getProfitAndLoss(): Promise<ProfitAndLossOut> {
  const now = new Date();
  const monthStarts = recentMonthStarts(REPORT_MONTHS, now);

  const payments = await repository.listPaymentsSince(monthStarts[0]);
  const expenses = await repository.listExpenses(monthStarts[0]);

  const revenueByMonth = new Map<string, number>();
  for (const payment of payments) {
    const key = monthKey(payment.createdAt);
    revenueByMonth.set(key, (revenueByMonth.get(key) ?? 0) + payment.amount);
  }
  const expensesByMonth = new Map<string, number>();
  for (const expense of expenses) {
    const key = monthKey(expense.createdAt);
    expensesByMonth.set(key, (expensesByMonth.get(key) ?? 0) + expense.amount);
  }

  const months = monthStarts.map((start) => {
    const key = monthKey(start);
    const revenue = revenueByMonth.get(key) ?? 0;
    const expensesForMonth = expensesByMonth.get(key) ?? 0;
    return { month: key, revenue, expenses: expensesForMonth, net_profit: revenue - expensesForMonth };
  });

  const totalRevenue = months.reduce((sum, m) => sum + m.revenue, 0);
  const totalExpenses = months.reduce((sum, m) => sum + m.expenses, 0);

  return {
    months,
    total_revenue: totalRevenue,
    total_expenses: totalExpenses,
    total_net_profit: totalRevenue - totalExpenses,
  };
}

export async function getExpenseBreakdown(): Promise<ExpenseBreakdownOut> {
  const rows = await repository.expenseTotalsByCategory();
  const total = rows.reduce((sum, row) => sum + Number(row.amount), 0);
  const items = rows.map((row) => ({
    category: row.category as (typeof ExpenseCategory)[keyof typeof ExpenseCategory],
    amount: Number(row.amount),
    percent: total ? Math.round((Number(row.amount) / total) * 1000) / 10 : 0,
  }));
  return { items, total };
}

export async function getMembershipGrowth(): Promise<MembershipGrowthOut> {
  const now = new Date();
  const monthStarts = recentMonthStarts(REPORT_MONTHS, now);
  const earliest = monthStarts[0];

  // Two counting queries instead of hydrating every member row.
  const baseline = await repository.countMembers(earliest);
  const newByMonth = await repository.countMembersByMonth(earliest);

  const months = [];
  let runningTotal = baseline;
  for (const start of monthStarts) {
    const key = monthKey(start);
    const newMembers = newByMonth.get(key) ?? 0;
    runningTotal += newMembers;
    months.push({ month: key, new_members: newMembers, total_members: runningTotal });
  }

  return { months };
}

export async function sendAnnouncement(
  adminId: string,
  payload: AnnouncementCreateInput,
): Promise<AnnouncementOut> {
  const memberIds = await repository.listMemberIds();
  await notificationsService.createNotifications(memberIds, 'announcement', payload.message);

  await auditLogService.record({
    actorId: adminId,
    action: AuditAction.ANNOUNCEMENT_SENT,
    metadata: { recipientCount: memberIds.length },
  });
  return { recipient_count: memberIds.length };
}

export async function listMembers(opts: {
  search: string | null;
  page: number;
  pageSize: number;
  role: string | null;
  status: string | null;
  sortBy: string;
  sortDir: string;
}): Promise<AdminMemberListOut> {
  const [users, total] = await repository.listMembers(opts);
  const memberIds = users.map((user) => user.id);

  const [latestPayments, planPaymentsByMember, progressCounts, reportedIds, eventRegistrationCounts] =
    await Promise.all([
      repository.listLatestPayments(memberIds),
      repository.listMembershipPaymentsByMember(memberIds),
      repository.countReadingProgressByStatus(memberIds),
      repository.findReportedMemberIds(memberIds),
      repository.countEventRegistrations(memberIds),
    ]);

  const now = new Date();
  const items: AdminMemberOut[] = users.map((user) => {
    const lastPayment = latestPayments.get(user.id);
    const planPayments = planPaymentsByMember.get(user.id) ?? [];
    const planPayment = planPayments.length > 0 ? planPayments[planPayments.length - 1] : undefined;

    let planExpiresAt: Date | null = null;
    let planIsActive = false;
    if (planPayments.length > 0) {
      // Shared with the member-facing view rather than approximated locally.
      planExpiresAt = calculateMembershipExpiry(planPayments);
      planIsActive = planExpiresAt !== null && planExpiresAt > now;
    }

    const counts = progressCounts.get(user.id) ?? { reading: 0, completed: 0 };

    return {
      id: user.id,
      full_name: user.fullName,
      email: user.email,
      role: user.role?.name ?? 'member',
      is_active: user.isActive,
      joined_at: user.createdAt.toISOString(),
      last_payment_amount: lastPayment?.amount ?? null,
      last_payment_label: lastPayment?.label ?? null,
      last_payment_at: lastPayment?.createdAt.toISOString() ?? null,
      plan_label: planPayment?.label ?? null,
      plan_expires_at: planExpiresAt?.toISOString() ?? null,
      plan_is_active: planIsActive,
      books_reading: counts.reading,
      books_completed: counts.completed,
      reported: reportedIds.has(user.id),
      event_registrations: eventRegistrationCounts.get(user.id) ?? 0,
    };
  });

  return { items, total, page: opts.page, page_size: opts.pageSize };
}

export async function listPayments(opts: {
  search: string | null;
  page: number;
  pageSize: number;
  month: string | null;
}): Promise<AdminPaymentListOut> {
  const [start, end] = opts.month ? parseMonthRange(opts.month) : [undefined, undefined];
  const [payments, total] = await repository.listPayments({
    search: opts.search,
    page: opts.page,
    pageSize: opts.pageSize,
    start,
    end,
  });

  const items: AdminPaymentOut[] = payments.map((payment) => ({
    id: payment.id,
    member_id: payment.userId,
    member_name: payment.user?.fullName ?? 'Unknown Member',
    member_email: payment.user?.email ?? '',
    amount: payment.amount,
    label: payment.label,
    status: payment.status,
    plan_months: payment.planMonths,
    created_at: payment.createdAt.toISOString(),
  }));
  return { items, total, page: opts.page, page_size: opts.pageSize };
}
