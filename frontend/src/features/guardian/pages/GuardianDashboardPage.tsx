import { BookOpen, HandCoins, MessageSquare, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

import { IconBadge, PageHeader, QuickActionsCard, StatisticCard } from '@/components/common';
import { Avatar, Card, CardContent, CardHeader, CardTitle, EmptyState } from '@/components/ui';
import { ROUTES } from '@/constants/routes';
import { RaiseTicketModal } from '@/features/support/components/RaiseTicketModal';
import { GUARDIAN_CATEGORIES } from '@/features/support/constants';
import { getErrorMessage } from '@/lib/api';
import { guardianStats } from '@/mocks/guardian';
import { useAuth, type GuardianChild } from '@/providers/AuthProvider';

import { BorrowedBooksByChild } from '../components/BorrowedBooksByChild';
import { ChildrenPresence } from '../components/ChildrenPresence';
import { SeatReservationForChild } from '../components/SeatReservationForChild';
import { SubscriptionAndFines } from '../components/SubscriptionAndFines';

// ponytail: child identity always comes from the real GuardianLink/ReadingProgress
// tables now (getGuardianChildren) — GuardianChild has no presence/loan/fine fields
// server-side yet, so ChildrenPresence/BorrowedBooksByChild/SubscriptionAndFines get
// empty arrays and show their honest empty states instead of fabricated per-child data.
function ChildrenReadingProgress({ realChildren }: { realChildren: GuardianChild[] }) {
  const { t } = useTranslation();

  return (
    <Card className="rounded-2xl shadow-panel">
      <CardHeader className="flex-row items-center gap-3 space-y-0">
        <IconBadge icon={BookOpen} size={9} />
        <CardTitle>{t('readingProgress.pageTitle')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2.5 text-sm">
        {realChildren.length === 0 ? (
          <EmptyState icon={BookOpen} title={t('readingProgress.emptyState.title')} />
        ) : (
          realChildren.map((child) => (
            <div
              key={child.id}
              className="flex items-center justify-between gap-2 rounded-xl border border-border-muted bg-secondary/10 p-3.5 transition-colors hover:border-primary/20"
            >
              <div className="flex items-center gap-3">
                <Avatar name={child.full_name} size="sm" />
                <span className="font-medium text-foreground">{child.full_name}</span>
              </div>
              <span className="text-muted-foreground">
                {child.currently_reading.length} reading · {child.completed.length} completed
              </span>
            </div>
          ))
        )}
        <Link
          to={ROUTES.READING_PROGRESS}
          className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          <BookOpen className="size-4" />
          {t('readingProgress.pageTitle')}
        </Link>
      </CardContent>
    </Card>
  );
}

export function GuardianDashboardPage() {
  const { t } = useTranslation();
  const { getGuardianChildren, payChildFines, renewChildSubscription } = useAuth();
  const [realChildren, setRealChildren] = useState<GuardianChild[]>([]);
  const [ticketModalOpen, setTicketModalOpen] = useState(false);

  function refreshChildren() {
    getGuardianChildren().then(setRealChildren).catch(() => setRealChildren([]));
  }

  useEffect(refreshChildren, [getGuardianChildren]);

  const childrenWithFines = realChildren.filter((child) => child.outstanding_fine > 0);

  async function handlePayAllFines() {
    if (childrenWithFines.length === 0) {
      toast.info(t('guardian.subscription.noFine'));
      return;
    }
    try {
      await Promise.all(childrenWithFines.map((child) => payChildFines(child.id)));
      toast.success(t('guardian.quickActions.toasts.payingAllFines'));
      refreshChildren();
    } catch (err) {
      toast.error(getErrorMessage(err, t('common.errors.generic')));
    }
  }

  async function handleRenewAll() {
    if (realChildren.length === 0) {
      toast.info(t('guardian.subscription.emptyTitle'));
      return;
    }
    try {
      await Promise.all(realChildren.map((child) => renewChildSubscription(child.id)));
      toast.success(t('guardian.quickActions.toasts.renewingSubscription'));
      refreshChildren();
    } catch (err) {
      toast.error(getErrorMessage(err, t('common.errors.generic')));
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('guardian.pageTitle')} description={t('guardian.pageDescription')} />

      <h2 className="sr-only">{t('common.dashboardSectionsHeading')}</h2>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {guardianStats.map((stat) => (
          <StatisticCard
            key={stat.labelKey}
            icon={stat.icon}
            label={t(stat.labelKey)}
            value={
              stat.labelKey === 'guardian.stats.linkedChildren'
                ? String(realChildren.length)
                : stat.value
            }
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChildrenPresence children={[]} />
        <BorrowedBooksByChild books={[]} children={[]} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SubscriptionAndFines children={realChildren} onChanged={refreshChildren} />
        <SeatReservationForChild children={realChildren} />
      </div>

      <ChildrenReadingProgress realChildren={realChildren} />

      <QuickActionsCard
        actions={[
          {
            label: t('guardian.quickActions.payAllFines'),
            icon: HandCoins,
            onClick: handlePayAllFines,
          },
          {
            label: t('guardian.quickActions.renewSubscription'),
            icon: RefreshCw,
            onClick: handleRenewAll,
          },
          {
            label: t('guardian.quickActions.contactStaff'),
            icon: MessageSquare,
            onClick: () => setTicketModalOpen(true),
          },
        ]}
      />

      <RaiseTicketModal
        open={ticketModalOpen}
        onClose={() => setTicketModalOpen(false)}
        categories={GUARDIAN_CATEGORIES}
        onCreated={() => toast.success(t('support.toasts.created'))}
      />
    </div>
  );
}
