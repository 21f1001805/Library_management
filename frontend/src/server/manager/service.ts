import type { Book, Loan } from '@prisma/client';

import { prisma } from '@/server/db';
import { HttpError } from '@/server/http';
import * as adminRepository from '@/server/admin/repository';
import * as adminService from '@/server/admin/service';
import { OPEN_HOURS } from '@/server/admin/constants';
import * as billingRequestsRepository from '@/server/billingRequests/repository';
import * as booksRepository from '@/server/books/repository';
import * as guardianService from '@/server/guardian/service';
import type { GuardianContactOut, GuardianLinkCreateInput } from '@/server/guardian/schemas';
import * as loansRepository from '@/server/loans/repository';
import * as loansService from '@/server/loans/service';
import { FINE_PER_DAY } from '@/server/loans/constants';
import type { LoanOut } from '@/server/loans/schemas';
import * as membersRepository from '@/server/members/repository';
import * as notificationsService from '@/server/notifications/service';
import * as reservationsEvents from '@/server/reservations/events';
import * as reservationsRepository from '@/server/reservations/repository';
import { reservationToJson, type ReservationOut } from '@/server/reservations/schemas';
import * as seatBookingService from '@/server/seatBooking/service';
import { SEAT_LABELS } from '@/server/seatBooking/constants';
import type { SeatBookingOut } from '@/server/seatBooking/schemas';
import * as visitsRepository from '@/server/visits/repository';
import * as insights from '@/server/manager/insights';
import * as repository from '@/server/manager/repository';
import {
  pendingReservationToJson,
  type DailyLibraryActivityOut,
  type DayOfWeekFootfallOut,
  type DemandForecastItemOut,
  type FootfallAnalyticsOut,
  type FootfallRange,
  type HourlyFootfallOut,
  type LateReturnRiskItemOut,
  type ManagerBookAvailabilityOut,
  type ManagerBookListOut,
  type ManagerDashboardStatsOut,
  type ManagerGuardianLinkCreateInput,
  type ManagerLoanCreateInput,
  type ManagerSeatBookingCreateInput,
  type MemberActivityMonthOut,
  type MostBorrowedBookOut,
  type MostBorrowedBooksOut,
  type OverdueFinesMonthOut,
  type PendingReservationOut,
  type RevenueMonthOut,
  type SeatUtilizationHourOut,
} from '@/server/manager/schemas';

// Mirrors backend/src/app/modules/manager/service.py.
const TOTAL_SEATS = SEAT_LABELS.length;
const MOST_BORROWED_LIMIT = 25;
const MEMBER_ACTIVITY_MONTHS = 6;
const OVERDUE_FINES_MONTHS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

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

function todayWindow(): [Date, Date] {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return [start, new Date(start.getTime() + DAY_MS)];
}

const FOOTFALL_RANGE_DAYS: Record<FootfallRange, number> = { '7d': 7, '30d': 30, '3m': 90 };

// One bulk fetch of every check-in in the window, bucketed by day / hour / weekday /
// duration — avoids one query per day the way a naive loop would.
export async function getFootfallAnalytics(rangeKey: FootfallRange): Promise<FootfallAnalyticsOut> {
  const days = FOOTFALL_RANGE_DAYS[rangeKey];
  const [todayStart] = todayWindow();
  const start = new Date(todayStart.getTime() - (days - 1) * DAY_MS);
  const end = new Date(todayStart.getTime() + DAY_MS);
  const visits = await visitsRepository.listCheckInsBetween(start, end);

  const visitsByDay = new Map<string, number>();
  const visitsByHour = new Map<number, number>();
  const visitsByWeekday = new Map<number, number>();
  const durationMinutes: number[] = [];
  for (const visit of visits) {
    const dayKey = visit.checkedInAt.toISOString().slice(0, 10);
    visitsByDay.set(dayKey, (visitsByDay.get(dayKey) ?? 0) + 1);
    const hour = visit.checkedInAt.getUTCHours();
    visitsByHour.set(hour, (visitsByHour.get(hour) ?? 0) + 1);
    const weekday = (visit.checkedInAt.getUTCDay() + 6) % 7; // Monday=0..Sunday=6, matching Python's date.weekday()
    visitsByWeekday.set(weekday, (visitsByWeekday.get(weekday) ?? 0) + 1);
    // Still-open visits (no checkedOutAt yet) simply don't contribute a duration.
    if (visit.checkedOutAt !== null) {
      const elapsed = (visit.checkedOutAt.getTime() - visit.checkedInAt.getTime()) / 1000 / 60;
      durationMinutes.push(elapsed);
    }
  }

  const dailyOut = Array.from({ length: days }, (_, offset) => {
    const date = new Date(start.getTime() + offset * DAY_MS);
    const key = date.toISOString().slice(0, 10);
    return { date: key, visits: visitsByDay.get(key) ?? 0 };
  });

  const peakHours: HourlyFootfallOut[] = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    visits: visitsByHour.get(hour) ?? 0,
  }));

  const averageVisitMinutes =
    durationMinutes.length > 0
      ? Math.round((durationMinutes.reduce((a, b) => a + b, 0) / durationMinutes.length) * 10) / 10
      : null;

  let busiestDay: DayOfWeekFootfallOut | null = null;
  let quietestDay: DayOfWeekFootfallOut | null = null;
  if (visits.length > 0) {
    const allWeekdayCounts = new Map<number, number>(Array.from({ length: 7 }, (_, d) => [d, 0]));
    for (const visit of visits) {
      const weekday = (visit.checkedInAt.getUTCDay() + 6) % 7;
      allWeekdayCounts.set(weekday, (allWeekdayCounts.get(weekday) ?? 0) + 1);
    }

    let busiestKey = 0;
    for (let day = 0; day < 7; day++) {
      const count = allWeekdayCounts.get(day) ?? 0;
      const bestCount = allWeekdayCounts.get(busiestKey) ?? 0;
      if (count > bestCount || (count === bestCount && day < busiestKey)) busiestKey = day;
    }
    let quietestKey = 0;
    let quietestBest = Infinity;
    for (let day = 0; day < 7; day++) {
      const count = allWeekdayCounts.get(day) ?? 0;
      const tiebreak = day === busiestKey ? 99 : day;
      if (count < quietestBest || (count === quietestBest && tiebreak < quietestKey)) {
        quietestKey = day;
        quietestBest = count;
      }
    }

    busiestDay = { day_of_week: busiestKey, visits: allWeekdayCounts.get(busiestKey) ?? 0 };
    quietestDay = { day_of_week: quietestKey, visits: allWeekdayCounts.get(quietestKey) ?? 0 };
  }

  return {
    range: rangeKey,
    daily: dailyOut,
    peak_hours: peakHours,
    average_visit_minutes: averageVisitMinutes,
    busiest_day: busiestDay,
    quietest_day: quietestDay,
  };
}

const LIBRARY_ACTIVITY_DAYS = 7;

async function getLibraryActivity(days = LIBRARY_ACTIVITY_DAYS): Promise<DailyLibraryActivityOut[]> {
  const [todayStart] = todayWindow();
  const activity: DailyLibraryActivityOut[] = [];
  for (let offset = days - 1; offset >= 0; offset--) {
    const dayStart = new Date(todayStart.getTime() - offset * DAY_MS);
    const dayEnd = new Date(dayStart.getTime() + DAY_MS);
    const issued = await repository.countLoansCreatedBetween(dayStart, dayEnd);
    const returned = await repository.countLoansReturnedBetween(dayStart, dayEnd);
    activity.push({ date: dayStart.toISOString().slice(0, 10), issued, returned });
  }
  return activity;
}

function rankBorrowedBooks(
  loans: (Loan & { book: Book })[],
  since: Date,
): MostBorrowedBookOut[] {
  const matching = loans.filter((loan) => loan.borrowedAt >= since);
  const counts = new Map<string, number>();
  const titles = new Map<string, string>();
  for (const loan of matching) {
    counts.set(loan.bookId, (counts.get(loan.bookId) ?? 0) + 1);
    titles.set(loan.bookId, loan.book.title);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MOST_BORROWED_LIMIT)
    .map(([bookId, count]) => ({ book_id: bookId, title: titles.get(bookId) ?? '', count }));
}

function mostBorrowedBooks(loans: (Loan & { book: Book })[], now: Date): MostBorrowedBooksOut {
  const threeMonthsStart = recentMonthStarts(3, now)[0];
  const sixMonthsStart = recentMonthStarts(6, now)[0];
  return {
    this_month: rankBorrowedBooks(loans, monthStart(now)),
    last_3_months: rankBorrowedBooks(loans, threeMonthsStart),
    last_6_months: rankBorrowedBooks(loans, sixMonthsStart),
  };
}

async function memberActivity(
  loans: (Loan & { book: Book })[],
  monthStarts: Date[],
): Promise<MemberActivityMonthOut[]> {
  const members = await repository.listMembersCreatedSince(monthStarts[0]);
  const newByMonth = new Map<string, number>();
  for (const member of members) {
    const key = monthKey(member.createdAt);
    newByMonth.set(key, (newByMonth.get(key) ?? 0) + 1);
  }

  const activeByMonth = new Map<string, Set<string>>();
  for (const loan of loans) {
    const key = monthKey(loan.borrowedAt);
    const set = activeByMonth.get(key) ?? new Set<string>();
    set.add(loan.memberId);
    activeByMonth.set(key, set);
  }

  return monthStarts.map((start) => {
    const key = monthKey(start);
    return {
      month: key,
      new_members: newByMonth.get(key) ?? 0,
      active_members: activeByMonth.get(key)?.size ?? 0,
    };
  });
}

async function seatUtilization(): Promise<SeatUtilizationHourOut[]> {
  const [todayStart] = todayWindow();
  const bookingsByHour = await adminRepository.countSeatBookingsByHour(todayStart);
  return OPEN_HOURS.map((hour) => ({
    hour,
    percent: Math.round(((bookingsByHour.get(hour) ?? 0) / TOTAL_SEATS) * 100),
  }));
}

async function overdueAndFines(
  loans: (Loan & { book: Book })[],
  monthStarts: Date[],
): Promise<OverdueFinesMonthOut[]> {
  const now = new Date();
  const overdueByMonth = new Map<string, number>();
  const generatedByMonth = new Map<string, number>();
  for (const loan of loans) {
    const end = loan.returnedAt ?? now;
    const daysLate = Math.max(
      0,
      Math.round(
        (Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()) -
          Date.UTC(
            loan.dueDate.getUTCFullYear(),
            loan.dueDate.getUTCMonth(),
            loan.dueDate.getUTCDate(),
          )) /
          DAY_MS,
      ),
    );
    if (daysLate > 0) {
      const key = monthKey(loan.dueDate);
      overdueByMonth.set(key, (overdueByMonth.get(key) ?? 0) + 1);
      generatedByMonth.set(key, (generatedByMonth.get(key) ?? 0) + daysLate * FINE_PER_DAY);
    }
  }

  const result: OverdueFinesMonthOut[] = [];
  for (let index = 0; index < monthStarts.length; index++) {
    const start = monthStarts[index];
    const endOfMonth = index + 1 < monthStarts.length ? monthStarts[index + 1] : undefined;
    const collected = await adminRepository.sumPayments({ start, end: endOfMonth, hasPlan: false });
    const key = monthKey(start);
    result.push({
      month: key,
      overdue_books: overdueByMonth.get(key) ?? 0,
      fines_generated: generatedByMonth.get(key) ?? 0,
      fines_collected: collected,
    });
  }
  return result;
}

async function revenue(): Promise<RevenueMonthOut[]> {
  // Reuses the admin dashboard's own revenue-by-month computation wholesale rather than
  // re-deriving it — same 6 months, same "what counts as revenue" definition.
  const profitAndLoss = await adminService.getProfitAndLoss();
  return profitAndLoss.months.map((m) => ({ month: m.month, total: m.revenue }));
}

export async function getDashboardStats(): Promise<ManagerDashboardStatsOut> {
  const [start, end] = todayWindow();
  const now = new Date();
  const memberActivityStarts = recentMonthStarts(MEMBER_ACTIVITY_MONTHS, now);
  const overdueFinesStarts = recentMonthStarts(OVERDUE_FINES_MONTHS, now);
  // memberActivityStarts is the wider (6-month) window and OVERDUE_FINES_MONTHS <
  // MEMBER_ACTIVITY_MONTHS, so one bulk fetch (by borrowedAt) safely covers both.
  const loansSince = await repository.listLoansBorrowedSince(memberActivityStarts[0]);

  const [
    seatsBookedToday,
    booksIssuedToday,
    newRegistrationsToday,
    pendingBillingRequests,
    openSupportTickets,
    pendingReservations,
    libraryActivity,
    memberActivityResult,
    seatUtilizationResult,
    overdueFinesResult,
    revenueResult,
  ] = await Promise.all([
    repository.countSeatBookingsCreatedBetween(start, end),
    repository.countLoansCreatedBetween(start, end),
    repository.countMembersCreatedBetween(start, end),
    billingRequestsRepository.countPending(),
    repository.countOpenSupportTickets(),
    repository.countPendingReservations(),
    getLibraryActivity(),
    memberActivity(loansSince, memberActivityStarts),
    seatUtilization(),
    overdueAndFines(loansSince, overdueFinesStarts),
    revenue(),
  ]);

  const mostBorrowed = mostBorrowedBooks(loansSince, now);

  return {
    seats_booked_today: seatsBookedToday,
    books_issued_today: booksIssuedToday,
    new_registrations_today: newRegistrationsToday,
    pending_tasks: pendingBillingRequests + openSupportTickets + pendingReservations,
    library_activity: libraryActivity,
    most_borrowed_books: mostBorrowed,
    member_activity: memberActivityResult,
    seat_utilization: seatUtilizationResult,
    overdue_fines: overdueFinesResult,
    revenue: revenueResult,
  };
}

async function findMemberOr404(memberId: string) {
  const member = await membersRepository.findById(memberId);
  if (!member || member.deletedAt !== null) throw new HttpError(404, 'Member not found');
  return member;
}

export async function bookSeatForMember(payload: ManagerSeatBookingCreateInput): Promise<SeatBookingOut> {
  const member = await findMemberOr404(payload.member_id);
  return seatBookingService.bookSeat(member, {
    seat_label: payload.seat_label,
    date: payload.date,
    hour: payload.hour,
  });
}

export async function issueLoanForMember(
  managerId: string,
  payload: ManagerLoanCreateInput,
): Promise<LoanOut> {
  await findMemberOr404(payload.member_id);
  return loansService.createLoan(
    managerId,
    { book_id: payload.book_id, member_id: payload.member_id },
    { durationDays: payload.duration_days },
  );
}

async function resolvePair(payload: ManagerGuardianLinkCreateInput): Promise<GuardianLinkCreateInput> {
  const student = await membersRepository.findByEmail(payload.student_email);
  const guardian = await membersRepository.findByEmail(payload.guardian_email);
  if (!student || !guardian) throw new HttpError(404, 'Guardian or member not found');
  return { guardian_id: guardian.id, member_id: student.id };
}

export async function linkGuardian(payload: ManagerGuardianLinkCreateInput): Promise<void> {
  await guardianService.linkChild(await resolvePair(payload));
}

export async function setGuardian(payload: ManagerGuardianLinkCreateInput): Promise<void> {
  await guardianService.setGuardian(await resolvePair(payload));
}

export async function unlinkGuardian(studentId: string): Promise<void> {
  await guardianService.unlinkChild(studentId);
}

export async function getStudentGuardian(studentId: string): Promise<GuardianContactOut | null> {
  return guardianService.getMyGuardian(studentId);
}

export async function listPendingReservations(): Promise<PendingReservationOut[]> {
  const rows = await reservationsRepository.listPending();
  return rows.map(pendingReservationToJson);
}

export async function approveReservation(
  managerId: string,
  reservationId: string,
  durationDays: number,
): Promise<ReservationOut> {
  const { reservation, updated, loan } = await prisma.$transaction(async (tx) => {
    // Serialize decisions for the same reservation, then re-read its state inside the
    // transaction. The loan helper separately locks the book inventory.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${reservationId}))`;
    const res = await reservationsRepository.findById(reservationId, tx);
    if (!res || res.status !== 'pending') {
      throw new HttpError(404, 'Pending reservation not found');
    }

    const createdLoan = await loansService.createLoan(
      managerId,
      { book_id: res.bookId, member_id: res.memberId },
      { durationDays, client: tx },
    );
    const updatedReservation = await reservationsRepository.approve(reservationId, createdLoan.id, tx);
    return { reservation: res, updated: updatedReservation, loan: createdLoan };
  });

  await notificationsService.createNotification(
    reservation.memberId,
    'reservation-approved',
    `Your request to borrow "${reservation.book.title}" was approved — please pick it up and ` +
      `return it by ${new Date(loan.due_date).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric', timeZone: 'UTC' })}.`,
  );
  // Published after the transaction commits, never inside it: a subscriber that
  // refetches on this signal must not be able to read the pre-commit state.
  await reservationsEvents.publishReservationsChanged(reservation.memberId);
  return reservationToJson(updated);
}

export async function rejectReservation(reservationId: string): Promise<ReservationOut> {
  const { reservation, updated } = await prisma.$transaction(async (tx) => {
    // Same lock key and same re-read-inside-the-transaction as approveReservation. Both
    // decisions must serialize against each other, or an approve that read 'pending'
    // before a rejection committed overwrites it and issues the book.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${reservationId}))`;
    const res = await reservationsRepository.findById(reservationId, tx);
    if (!res || res.status !== 'pending') {
      throw new HttpError(404, 'Pending reservation not found');
    }
    const updatedReservation = await reservationsRepository.reject(reservationId, tx);
    return { reservation: res, updated: updatedReservation };
  });

  await notificationsService.createNotification(
    reservation.memberId,
    'reservation-rejected',
    `Your request to borrow "${reservation.book.title}" was declined.`,
  );
  await reservationsEvents.publishReservationsChanged(reservation.memberId);
  return reservationToJson(updated);
}

export async function listBookAvailability(opts: {
  search: string | null;
  page: number;
  pageSize: number;
}): Promise<ManagerBookListOut> {
  const [books, total] = await repository.listBooks(opts);
  const activeLoans = await repository.listActiveLoansForBooks(books.map((book) => book.id));

  const loanedOutCount = new Map<string, number>();
  const earliestDueAt = new Map<string, Date>();
  for (const loan of activeLoans) {
    loanedOutCount.set(loan.bookId, (loanedOutCount.get(loan.bookId) ?? 0) + 1);
    // Loans arrive sorted by dueDate ascending, so the first one seen per book is
    // already the earliest.
    if (!earliestDueAt.has(loan.bookId)) earliestDueAt.set(loan.bookId, loan.dueDate);
  }

  const items: ManagerBookAvailabilityOut[] = books.map((book) => {
    const availableCopies = Math.max(0, book.totalCopies - (loanedOutCount.get(book.id) ?? 0));
    return {
      id: book.id,
      title: book.title,
      author: book.author,
      category: book.category,
      total_copies: book.totalCopies,
      available_copies: availableCopies,
      is_available: availableCopies > 0,
      expected_available_at:
        availableCopies > 0 ? null : (earliestDueAt.get(book.id)?.toISOString() ?? null),
    };
  });

  return { items, total, page: opts.page, page_size: opts.pageSize };
}

export async function getDemandForecast(): Promise<DemandForecastItemOut[]> {
  const now = new Date();
  const recentStart = new Date(now.getTime() - insights.DEMAND_RECENT_WINDOW_DAYS * DAY_MS);
  const priorStart = new Date(recentStart.getTime() - insights.DEMAND_PRIOR_WINDOW_DAYS * DAY_MS);

  const [loanCounts, reservationCounts, pending] = await Promise.all([
    repository.countLoansByBookInWindows(recentStart, priorStart),
    repository.countReservationsByBookInWindows(recentStart, priorStart),
    reservationsRepository.listPending(),
  ]);

  const pendingByBook = new Map<string, number>();
  for (const reservation of pending) {
    pendingByBook.set(reservation.bookId, (pendingByBook.get(reservation.bookId) ?? 0) + 1);
  }

  const bookIds = new Set([...loanCounts.keys(), ...reservationCounts.keys(), ...pendingByBook.keys()]);
  if (bookIds.size === 0) return [];

  const books = await booksRepository.listByIds([...bookIds]);
  const booksById = new Map(books.map((book) => [book.id, book]));

  const scored: [insights.DemandForecast, Book][] = [];
  for (const bookId of bookIds) {
    const book = booksById.get(bookId);
    if (!book || book.deletedAt !== null) continue;
    const [loanRecent, loanPrior] = loanCounts.get(bookId) ?? [0, 0];
    const [resRecent, resPrior] = reservationCounts.get(bookId) ?? [0, 0];
    const forecast = insights.scoreDemand({
      bookId,
      recentActivity: loanRecent + resRecent,
      priorActivity: loanPrior + resPrior,
      pendingReservations: pendingByBook.get(bookId) ?? 0,
      totalCopies: book.totalCopies,
    });
    if (forecast) scored.push([forecast, book]);
  }

  scored.sort((a, b) => {
    const aHigh = a[0].demandLevel === 'high' ? 1 : 0;
    const bHigh = b[0].demandLevel === 'high' ? 1 : 0;
    if (aHigh !== bHigh) return bHigh - aHigh;
    return (b[0].changePct ?? 0) - (a[0].changePct ?? 0);
  });

  return scored.slice(0, insights.DEMAND_RESULT_LIMIT).map(([forecast, book]) => ({
    book_id: book.id,
    title: book.title,
    author: book.author,
    category: book.category,
    total_copies: book.totalCopies,
    recent_activity: forecast.recentActivity,
    prior_activity: forecast.priorActivity,
    change_pct: forecast.changePct,
    pending_reservations: forecast.pendingReservations,
    demand_level: forecast.demandLevel,
    reason: forecast.reason,
  }));
}

export async function getLateReturnRisk(): Promise<LateReturnRiskItemOut[]> {
  const now = new Date();
  const [activeLoans, historyByMember] = await Promise.all([
    loansRepository.listActive(),
    repository.memberLateReturnHistory(),
  ]);
  if (activeLoans.length === 0) return [];

  let totalLate = 0;
  let totalReturns = 0;
  for (const [late, total] of historyByMember.values()) {
    totalLate += late;
    totalReturns += total;
  }
  const libraryWideRatePct = totalReturns > 0 ? (totalLate / totalReturns) * 100 : 0.0;

  const items: LateReturnRiskItemOut[] = activeLoans.map((loan) => {
    const [late, total] = historyByMember.get(loan.memberId) ?? [0, 0];
    const memberHistory = total > 0 ? { lateReturns: late, totalReturns: total } : null;
    const risk = insights.scoreLateReturnRisk({
      dueDate: loan.dueDate,
      now,
      memberHistory,
      libraryWideLateRatePct: libraryWideRatePct,
    });
    const daysOverdue = Math.max(
      0,
      Math.round(
        (Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) -
          Date.UTC(
            loan.dueDate.getUTCFullYear(),
            loan.dueDate.getUTCMonth(),
            loan.dueDate.getUTCDate(),
          )) /
          DAY_MS,
      ),
    );
    return {
      loan_id: loan.id,
      book_title: loan.book.title,
      member_id: loan.memberId,
      member_name: loan.member.fullName,
      due_date: loan.dueDate.toISOString(),
      is_overdue: loan.dueDate < now,
      days_overdue: daysOverdue,
      risk_score: risk.riskScore,
      risk_level: risk.riskLevel,
      reason: risk.reason,
    };
  });

  items.sort((a, b) => b.risk_score - a.risk_score);
  return items.slice(0, insights.LATE_RETURN_RESULT_LIMIT);
}
