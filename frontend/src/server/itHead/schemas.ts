import type { TrendOut } from '@/server/admin/schemas';

// Mirrors backend/src/app/modules/it_head/schemas.py.
export interface ITHeadStatsOut {
  active_members: number;
  active_members_trend: TrendOut;
  open_issues: number;
  open_issues_delta: number;
  pending_permissions: number;
  pending_permissions_delta: number;
  fees_outstanding: number;
  fees_outstanding_trend: TrendOut;
  late_fines_outstanding: number;
  late_fines_outstanding_trend: TrendOut;
}

export interface FeeStatusEntryOut {
  member_id: string;
  member_name: string;
  amount_due: number;
  status: 'paid' | 'due' | 'overdue';
  due_date: string | null;
}

export interface FeeCollectionMonthOut {
  month: string;
  collected: number;
  pending: number;
}

export interface IssueResolutionMonthOut {
  month: string;
  resolved: number;
  open: number;
  other: number;
}

export interface SystemActivityDayOut {
  date: string;
  logins: number;
  access_changes: number;
  permissions_updated: number;
}

export interface SystemActivitySummaryOut {
  logins_total: number;
  logins_trend: TrendOut;
  access_changes_total: number;
  access_changes_trend: TrendOut;
  permissions_updated_total: number;
  permissions_updated_trend: TrendOut;
}

export interface RoleBreakdownEntryOut {
  role: string;
  count: number;
  percent: number;
}

export interface ITHeadAlertOut {
  id: string;
  severity: 'critical' | 'warning' | 'info' | 'success';
  title: string;
  description: string;
}

export interface ITHeadDashboardOut {
  stats: ITHeadStatsOut;
  fee_status: FeeStatusEntryOut[];
  fee_collections: FeeCollectionMonthOut[];
  issue_resolution: IssueResolutionMonthOut[];
  system_activity: SystemActivityDayOut[];
  system_activity_summary: SystemActivitySummaryOut;
  access_by_role: RoleBreakdownEntryOut[];
  alerts: ITHeadAlertOut[];
}
