import { z } from 'zod';

import type { Expense } from '@prisma/client';
import { ExpenseCategory } from '@/server/admin/constants';

// Mirrors backend/src/app/modules/admin/schemas.py.
export interface TrendOut {
  direction: 'up' | 'down';
  percent: number;
}

export interface AdminStatsOut {
  revenue_mtd: number;
  revenue_trend: TrendOut;
  expenses_mtd: number;
  expenses_trend: TrendOut;
  net_profit_mtd: number;
  net_profit_trend: TrendOut;
  total_members: number;
  total_members_trend: TrendOut;
}

export interface RevenueSourceOut {
  source: string;
  amount: number;
}

export interface BudgetCategoryOut {
  category: string;
  budgeted: number;
  spent: number;
}

export const expenseCreateSchema = z.object({
  category: z.enum(Object.values(ExpenseCategory) as [string, ...string[]]),
  amount: z.number().int().positive(),
});
export type ExpenseCreateInput = z.infer<typeof expenseCreateSchema>;

export interface ExpenseOut {
  id: string;
  category: string;
  amount: number;
  created_at: string;
}

export function expenseToJson(expense: Expense): ExpenseOut {
  return {
    id: expense.id,
    category: expense.category,
    amount: expense.amount,
    created_at: expense.createdAt.toISOString(),
  };
}

export interface SeatStatusOut {
  available: number;
  booked: number;
  total: number;
}

export interface SeatOccupancySlotOut {
  hour: number;
  percent_filled: number;
}

export interface AdminDashboardOut {
  stats: AdminStatsOut;
  cash_flow: RevenueSourceOut[];
  budget: BudgetCategoryOut[];
  seat_status: SeatStatusOut;
  seat_occupancy: SeatOccupancySlotOut[];
}

export interface RevenueByPlanItemOut {
  label: string;
  amount: number;
  count: number;
}

export interface RevenueByPlanOut {
  items: RevenueByPlanItemOut[];
  total: number;
}

export interface MonthlyFigureOut {
  month: string;
  revenue: number;
  expenses: number;
  net_profit: number;
}

export interface ProfitAndLossOut {
  months: MonthlyFigureOut[];
  total_revenue: number;
  total_expenses: number;
  total_net_profit: number;
}

export interface ExpenseBreakdownItemOut {
  category: string;
  amount: number;
  percent: number;
}

export interface ExpenseBreakdownOut {
  items: ExpenseBreakdownItemOut[];
  total: number;
}

export interface MembershipGrowthMonthOut {
  month: string;
  new_members: number;
  total_members: number;
}

export interface MembershipGrowthOut {
  months: MembershipGrowthMonthOut[];
}

export const announcementCreateSchema = z.object({
  message: z.string().min(1).max(500),
});
export type AnnouncementCreateInput = z.infer<typeof announcementCreateSchema>;

export interface AnnouncementOut {
  recipient_count: number;
}

export interface AdminMemberOut {
  id: string;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
  joined_at: string;
  last_payment_amount: number | null;
  last_payment_label: string | null;
  last_payment_at: string | null;
  plan_label: string | null;
  plan_expires_at: string | null;
  plan_is_active: boolean;
  books_reading: number;
  books_completed: number;
  reported: boolean;
  event_registrations: number;
}

export interface AdminMemberListOut {
  items: AdminMemberOut[];
  total: number;
  page: number;
  page_size: number;
}

export interface AdminPaymentOut {
  id: string;
  member_id: string;
  member_name: string;
  member_email: string;
  amount: number;
  label: string;
  status: string;
  plan_months: number | null;
  created_at: string;
}

export interface AdminPaymentListOut {
  items: AdminPaymentOut[];
  total: number;
  page: number;
  page_size: number;
}
