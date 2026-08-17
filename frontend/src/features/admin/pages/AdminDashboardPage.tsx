import {
  BadgeIndianRupee,
  CalendarPlus,
  HandCoins,
  IndianRupee,
  Megaphone,
  ReceiptText,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PageHeader, QuickActionsCard, StatisticCard } from '@/components/common';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { formatCurrency } from '@/lib/format';
import {
  type AdminDashboard,
  type AdminTrend,
  type AuditLogEntry,
  type BillingRequestRecord,
  type ExpenseCategory,
  useAuth,
} from '@/providers/AuthProvider';

import { CreateEventModal } from '@/features/events/components/CreateEventModal';

import { AdjustPricingModal } from '../components/AdjustPricingModal';
import { AnnouncementModal } from '../components/AnnouncementModal';
import { AuditLog } from '../components/AuditLog';
import { BudgetExpenses } from '../components/BudgetExpenses';
import { CashFlowBreakdown } from '../components/CashFlowBreakdown';
import { InviteMemberModal } from '../components/InviteMemberModal';
import { LiveSeatStatus } from '../components/LiveSeatStatus';
import { LogExpenseModal } from '../components/LogExpenseModal';
import { PendingRequests } from '../components/PendingRequests';
import { ReportModal, type ReportKey } from '../components/ReportModal';
import { SeatOccupancySummary } from '../components/SeatOccupancySummary';
import { WaiveFineModal } from '../components/WaiveFineModal';

// More spending is bad news even when the number itself goes up — invert the
// default up-is-good sentiment for this one stat.
function expenseSentiment(trend: AdminTrend): 'positive' | 'negative' {
  return trend.direction === 'up' ? 'negative' : 'positive';
}

const REPORTS: { key: ReportKey; labelKey: string }[] = [
  { key: 'revenueByPlan', labelKey: 'admin.reports.items.revenueByPlan' },
  { key: 'profitAndLoss', labelKey: 'admin.reports.items.profitAndLoss' },
  { key: 'expenseBreakdown', labelKey: 'admin.reports.items.expenseBreakdown' },
  { key: 'membershipGrowth', labelKey: 'admin.reports.items.membershipGrowth' },
];

export function AdminDashboardPage() {
  const { t } = useTranslation();
  const { getAdminDashboard, getBillingRequests, getAuditLog } = useAuth();
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [billingRequests, setBillingRequests] = useState<BillingRequestRecord[]>([]);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [loggingCategory, setLoggingCategory] = useState<ExpenseCategory | null>(null);
  const [isLogExpenseOpen, setIsLogExpenseOpen] = useState(false);
  const [isWaiveFineOpen, setIsWaiveFineOpen] = useState(false);
  const [isAdjustPricingOpen, setIsAdjustPricingOpen] = useState(false);
  const [isInviteMemberOpen, setIsInviteMemberOpen] = useState(false);
  const [isAnnouncementOpen, setIsAnnouncementOpen] = useState(false);
  const [createEventOpen, setCreateEventOpen] = useState(false);
  const [activeReport, setActiveReport] = useState<ReportKey | null>(null);

  function refresh() {
    getAdminDashboard()
      .then(setDashboard)
      .catch(() => setDashboard(null));
  }

  function refreshBillingRequests() {
    getBillingRequests()
      .then(setBillingRequests)
      .catch(() => setBillingRequests([]));
  }

  function refreshAuditLog() {
    getAuditLog()
      .then(setAuditLog)
      .catch(() => setAuditLog([]));
  }

  useEffect(refresh, [getAdminDashboard]);
  useEffect(refreshBillingRequests, [getBillingRequests]);
  useEffect(refreshAuditLog, [getAuditLog]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('admin.pageTitle')} description={t('admin.pageDescription')} />

      <h2 className="sr-only">{t('common.dashboardSectionsHeading')}</h2>

      {dashboard && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatisticCard
              icon={IndianRupee}
              label={t('admin.stats.revenueMtd')}
              value={formatCurrency(dashboard.stats.revenue_mtd)}
              trend={dashboard.stats.revenue_trend}
            />
            <StatisticCard
              icon={TrendingDown}
              label={t('admin.stats.expensesMtd')}
              value={formatCurrency(dashboard.stats.expenses_mtd)}
              trend={{
                ...dashboard.stats.expenses_trend,
                sentiment: expenseSentiment(dashboard.stats.expenses_trend),
              }}
            />
            <StatisticCard
              icon={Wallet}
              label={t('admin.stats.netProfitMtd')}
              value={formatCurrency(dashboard.stats.net_profit_mtd)}
              trend={dashboard.stats.net_profit_trend}
            />
            <StatisticCard
              icon={Users}
              label={t('admin.stats.totalMembers')}
              value={String(dashboard.stats.total_members)}
              trend={dashboard.stats.total_members_trend}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <CashFlowBreakdown sources={dashboard.cash_flow} />
            <BudgetExpenses categories={dashboard.budget} onLogExpense={setLoggingCategory} />
          </div>

          <LiveSeatStatus status={dashboard.seat_status} />

          <SeatOccupancySummary slots={dashboard.seat_occupancy} />
        </>
      )}

      <PendingRequests
        requests={billingRequests}
        onDecided={() => {
          refreshBillingRequests();
          refreshAuditLog();
        }}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AuditLog entries={auditLog} />

        <Card>
          <CardHeader>
            <CardTitle>{t('admin.reports.title')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {REPORTS.map((report) => (
              <div key={report.key} className="flex items-center justify-between text-sm">
                <span className="text-foreground">{t(report.labelKey)}</span>
                <Button size="sm" variant="ghost" onClick={() => setActiveReport(report.key)}>
                  {t('common.actions.viewReport')}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <QuickActionsCard
        actions={[
          {
            label: 'Create Event',
            icon: CalendarPlus,
            onClick: () => setCreateEventOpen(true),
          },
          {
            label: t('admin.quickActions.logExpense'),
            icon: ReceiptText,
            onClick: () => setIsLogExpenseOpen(true),
          },
          {
            label: t('admin.quickActions.adjustPricing'),
            icon: BadgeIndianRupee,
            onClick: () => setIsAdjustPricingOpen(true),
          },
          {
            label: t('admin.quickActions.inviteMember'),
            icon: UserPlus,
            onClick: () => setIsInviteMemberOpen(true),
          },
          {
            label: t('admin.quickActions.announcement'),
            icon: Megaphone,
            onClick: () => setIsAnnouncementOpen(true),
          },
          {
            label: t('admin.quickActions.viewGrowthReport'),
            icon: TrendingUp,
            onClick: () => setActiveReport('membershipGrowth'),
          },
          {
            label: t('admin.quickActions.waiveFine'),
            icon: HandCoins,
            onClick: () => setIsWaiveFineOpen(true),
          },
        ]}
      />

      <ReportModal reportKey={activeReport} onClose={() => setActiveReport(null)} />

      <WaiveFineModal
        open={isWaiveFineOpen}
        onClose={() => setIsWaiveFineOpen(false)}
        onWaived={() => {
          refreshBillingRequests();
          refreshAuditLog();
        }}
      />

      <LogExpenseModal
        open={loggingCategory !== null || isLogExpenseOpen}
        onClose={() => {
          setLoggingCategory(null);
          setIsLogExpenseOpen(false);
        }}
        category={loggingCategory}
        categoryLabel={loggingCategory ? t(`admin.budget.categories.${loggingCategory}`) : undefined}
        onLogged={() => {
          refresh();
          refreshAuditLog();
        }}
      />

      <AdjustPricingModal open={isAdjustPricingOpen} onClose={() => setIsAdjustPricingOpen(false)} />

      <InviteMemberModal
        open={isInviteMemberOpen}
        onClose={() => setIsInviteMemberOpen(false)}
        onInvited={refresh}
      />

      <AnnouncementModal
        open={isAnnouncementOpen}
        onClose={() => setIsAnnouncementOpen(false)}
        onSent={refreshAuditLog}
      />

      <CreateEventModal
        open={createEventOpen}
        onClose={() => setCreateEventOpen(false)}
        onSaved={() => setCreateEventOpen(false)}
      />
    </div>
  );
}
