import {
  Armchair,
  BookPlus,
  CalendarPlus,
  ClipboardList,
  KeyRound,
  ReceiptText,
  UserPlus,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PageHeader, QuickActionsCard, StatisticCard } from '@/components/common';
import { CreateEventModal } from '@/features/events/components/CreateEventModal';
import type { RegistrationRequest, WalkInRequest } from '@/mocks/manager';
import {
  useAuth,
  type AppNotificationRecord,
  type LoanDurationDays,
  type LoanRecord,
  type ManagerDashboardStats,
  type PendingReservationRequest,
} from '@/providers/AuthProvider';

import { ActiveLoans } from '../components/ActiveLoans';
import { AddGuardianCard } from '../components/AddGuardianCard';
import { BookSeatForMemberModal } from '../components/BookSeatForMemberModal';
import { FileBillingRequestModal } from '../components/FileBillingRequestModal';
import { IssueBookForMemberModal } from '../components/IssueBookForMemberModal';
import { NewRegistrations } from '../components/NewRegistrations';
import { PendingPayments } from '../components/PendingPayments';
import { PendingReservations } from '../components/PendingReservations';
import { RegisterMemberModal } from '../components/RegisterMemberModal';
import { RequestPermissionModal } from '../components/RequestPermissionModal';
import { WalkInAssistance } from '../components/WalkInAssistance';

// No online flow yet lets a visitor submit a walk-in / registration request,
// so these two queues have nothing real to show — kept empty rather than mocked.
// Pending cash payments DO have a real source now: the "pay at the library" option
// on the Payment page files a "payment-pending" notification to every manager.
const NO_WALK_INS: WalkInRequest[] = [];
const NO_REGISTRATIONS: RegistrationRequest[] = [];

// Manager duties: assist walk-in members with seat/book counter service
// (taking their email and booking/issuing on their behalf) and help new
// visitors register — no event management.
export function ManagerDashboard() {
  const { t } = useTranslation();
  const {
    getManagerDashboard,
    getPendingReservations,
    approveReservation,
    rejectReservation,
    getActiveLoans,
    returnLoan,
    sendFineReminder,
    getMyNotifications,
    markNotificationRead,
  } = useAuth();
  const [stats, setStats] = useState<ManagerDashboardStats | null>(null);
  const [pendingReservations, setPendingReservations] = useState<PendingReservationRequest[]>([]);
  const [activeLoans, setActiveLoans] = useState<LoanRecord[]>([]);
  const [pendingPayments, setPendingPayments] = useState<AppNotificationRecord[]>([]);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isBookSeatOpen, setIsBookSeatOpen] = useState(false);
  const [isIssueBookOpen, setIsIssueBookOpen] = useState(false);
  const [createEventOpen, setCreateEventOpen] = useState(false);
  const [isBillingRequestOpen, setIsBillingRequestOpen] = useState(false);
  const [isRequestPermissionOpen, setIsRequestPermissionOpen] = useState(false);

  function refreshStats() {
    getManagerDashboard()
      .then(setStats)
      .catch(() => setStats(null));
  }

  function refreshPendingReservations() {
    getPendingReservations()
      .then(setPendingReservations)
      .catch(() => setPendingReservations([]));
  }

  function refreshActiveLoans() {
    getActiveLoans()
      .then(setActiveLoans)
      .catch(() => setActiveLoans([]));
  }

  function refreshPendingPayments() {
    getMyNotifications()
      .then((notifications) =>
        setPendingPayments(notifications.filter((n) => n.type === 'payment-pending' && !n.read)),
      )
      .catch(() => setPendingPayments([]));
  }

  useEffect(refreshStats, [getManagerDashboard]);
  useEffect(refreshPendingReservations, [getPendingReservations]);
  useEffect(refreshActiveLoans, [getActiveLoans]);
  useEffect(refreshPendingPayments, [getMyNotifications]);

  async function handleMarkPaymentPaid(notificationId: string) {
    await markNotificationRead(notificationId);
    refreshPendingPayments();
  }

  async function handleApproveReservation(id: string, durationDays: LoanDurationDays) {
    await approveReservation(id, durationDays);
    refreshPendingReservations();
    refreshActiveLoans();
    refreshStats();
  }

  async function handleRejectReservation(id: string) {
    await rejectReservation(id);
    refreshPendingReservations();
    refreshStats();
  }

  async function handleReturnLoan(id: string) {
    await returnLoan(id);
    refreshActiveLoans();
  }

  const statCards = [
    {
      key: 'seatsBookedToday',
      icon: Armchair,
      value: stats?.seats_booked_today,
    },
    {
      key: 'booksIssuedToday',
      icon: BookPlus,
      value: stats?.books_issued_today,
    },
    {
      key: 'newRegistrationsToday',
      icon: UserPlus,
      value: stats?.new_registrations_today,
    },
    {
      key: 'pendingTasks',
      icon: ClipboardList,
      value: stats?.pending_tasks,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('managerDashboard.pageTitle')}
        description={t('managerDashboard.pageDescription')}
      />

      <h2 className="sr-only">{t('common.dashboardSectionsHeading')}</h2>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statCards.map((stat) => (
          <StatisticCard
            key={stat.key}
            icon={stat.icon}
            label={t(`managerDashboard.stats.${stat.key}`)}
            value={stat.value === undefined ? '—' : String(stat.value)}
          />
        ))}
      </div>

      <PendingReservations
        requests={pendingReservations}
        onApprove={handleApproveReservation}
        onReject={handleRejectReservation}
      />

      <ActiveLoans loans={activeLoans} onReturn={handleReturnLoan} onRemind={sendFineReminder} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <WalkInAssistance requests={NO_WALK_INS} />
        <NewRegistrations requests={NO_REGISTRATIONS} onRegister={() => setIsRegisterOpen(true)} />
      </div>

      <PendingPayments payments={pendingPayments} onMarkPaid={handleMarkPaymentPaid} />

      <AddGuardianCard />

      <QuickActionsCard
        actions={[
          {
            label: 'Create Event',
            icon: CalendarPlus,
            onClick: () => setCreateEventOpen(true),
          },
          {
            label: t('managerDashboard.quickActions.bookSeatForMember'),
            icon: Armchair,
            onClick: () => setIsBookSeatOpen(true),
          },
          {
            label: t('managerDashboard.quickActions.issueBookForMember'),
            icon: BookPlus,
            onClick: () => setIsIssueBookOpen(true),
          },
          {
            label: t('managerDashboard.quickActions.registerNewMember'),
            icon: UserPlus,
            onClick: () => setIsRegisterOpen(true),
          },
          {
            label: t('managerDashboard.quickActions.fileBillingRequest'),
            icon: ReceiptText,
            onClick: () => setIsBillingRequestOpen(true),
          },
          {
            label: t('managerDashboard.quickActions.requestPermission'),
            icon: KeyRound,
            onClick: () => setIsRequestPermissionOpen(true),
          },
        ]}
      />

      <RequestPermissionModal
        open={isRequestPermissionOpen}
        onClose={() => setIsRequestPermissionOpen(false)}
      />

      <RegisterMemberModal
        open={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        onRegistered={refreshStats}
      />

      <BookSeatForMemberModal
        open={isBookSeatOpen}
        onClose={() => setIsBookSeatOpen(false)}
        onBooked={refreshStats}
      />

      <IssueBookForMemberModal
        open={isIssueBookOpen}
        onClose={() => setIsIssueBookOpen(false)}
        onIssued={() => {
          refreshStats();
          refreshActiveLoans();
        }}
      />

      <FileBillingRequestModal
        open={isBillingRequestOpen}
        onClose={() => setIsBillingRequestOpen(false)}
      />

      <CreateEventModal
        open={createEventOpen}
        onClose={() => setCreateEventOpen(false)}
        onSaved={() => setCreateEventOpen(false)}
      />
    </div>
  );
}
