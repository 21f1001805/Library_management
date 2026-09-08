import { z } from 'zod';

import type * as reservationsRepository from '@/server/reservations/repository';
import { SEAT_LABELS } from '@/server/seatBooking/constants';

// Mirrors backend/src/app/modules/manager/schemas.py.
const durationDays = z.union([z.literal(3), z.literal(5), z.literal(7), z.literal(10)]);

export interface DailyLibraryActivityOut {
  date: string;
  issued: number;
  returned: number;
}

export interface MostBorrowedBookOut {
  book_id: string;
  title: string;
  count: number;
}

export interface MostBorrowedBooksOut {
  this_month: MostBorrowedBookOut[];
  last_3_months: MostBorrowedBookOut[];
  last_6_months: MostBorrowedBookOut[];
}

export interface MemberActivityMonthOut {
  month: string;
  new_members: number;
  active_members: number;
}

export interface SeatUtilizationHourOut {
  hour: number;
  percent: number;
}

export interface OverdueFinesMonthOut {
  month: string;
  overdue_books: number;
  fines_generated: number;
  fines_collected: number;
}

export interface RevenueMonthOut {
  month: string;
  total: number;
}

export interface ManagerDashboardStatsOut {
  seats_booked_today: number;
  books_issued_today: number;
  new_registrations_today: number;
  pending_tasks: number;
  library_activity: DailyLibraryActivityOut[];
  most_borrowed_books: MostBorrowedBooksOut;
  member_activity: MemberActivityMonthOut[];
  seat_utilization: SeatUtilizationHourOut[];
  overdue_fines: OverdueFinesMonthOut[];
  revenue: RevenueMonthOut[];
}

export const managerSeatBookingCreateSchema = z.object({
  member_id: z.string(),
  seat_label: z.string().refine((value) => SEAT_LABELS.includes(value), { message: 'Unknown seat' }),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hour: z.number().int().min(0).max(23),
});
export type ManagerSeatBookingCreateInput = z.infer<typeof managerSeatBookingCreateSchema>;

export const managerLoanCreateSchema = z.object({
  member_id: z.string(),
  book_id: z.string(),
  duration_days: durationDays,
});
export type ManagerLoanCreateInput = z.infer<typeof managerLoanCreateSchema>;

export const managerReservationDecisionSchema = z.object({
  duration_days: durationDays,
});
export type ManagerReservationDecisionInput = z.infer<typeof managerReservationDecisionSchema>;

export const managerGuardianLinkCreateSchema = z.object({
  student_email: z.string().email(),
  guardian_email: z.string().email(),
});
export type ManagerGuardianLinkCreateInput = z.infer<typeof managerGuardianLinkCreateSchema>;

export interface PendingReservationOut {
  id: string;
  book_id: string;
  book_title: string;
  member_id: string;
  member_name: string;
  member_email: string;
  requested_at: string;
}

type PendingReservationRow = Awaited<ReturnType<typeof reservationsRepository.listPending>>[number];

export function pendingReservationToJson(reservation: PendingReservationRow): PendingReservationOut {
  return {
    id: reservation.id,
    book_id: reservation.bookId,
    book_title: reservation.book.title,
    member_id: reservation.memberId,
    member_name: reservation.member.fullName,
    member_email: reservation.member.email,
    requested_at: reservation.createdAt.toISOString(),
  };
}

export interface ManagerBookAvailabilityOut {
  id: string;
  title: string;
  author: string;
  category: string;
  total_copies: number;
  available_copies: number;
  is_available: boolean;
  expected_available_at: string | null;
}

export interface ManagerBookListOut {
  items: ManagerBookAvailabilityOut[];
  total: number;
  page: number;
  page_size: number;
}

export interface DemandForecastItemOut {
  book_id: string;
  title: string;
  author: string;
  category: string;
  total_copies: number;
  recent_activity: number;
  prior_activity: number;
  change_pct: number | null;
  pending_reservations: number;
  demand_level: 'high' | 'medium';
  reason: string;
}

export interface LateReturnRiskItemOut {
  loan_id: string;
  book_title: string;
  member_id: string;
  member_name: string;
  due_date: string;
  is_overdue: boolean;
  days_overdue: number;
  risk_score: number;
  risk_level: 'low' | 'medium' | 'high';
  reason: string;
}

export const FOOTFALL_RANGES = ['7d', '30d', '3m'] as const;
export type FootfallRange = (typeof FOOTFALL_RANGES)[number];

export interface DailyFootfallOut {
  date: string;
  visits: number;
}

export interface HourlyFootfallOut {
  hour: number;
  visits: number;
}

export interface DayOfWeekFootfallOut {
  day_of_week: number;
  visits: number;
}

export interface FootfallAnalyticsOut {
  range: FootfallRange;
  daily: DailyFootfallOut[];
  peak_hours: HourlyFootfallOut[];
  average_visit_minutes: number | null;
  busiest_day: DayOfWeekFootfallOut | null;
  quietest_day: DayOfWeekFootfallOut | null;
}
