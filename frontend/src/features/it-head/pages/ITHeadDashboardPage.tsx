import { AlertCircle, Clock, IndianRupee, KeyRound, UploadCloud, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PageHeader, QuickActionsCard, StatisticCard } from '@/components/common';
import { formatCurrency } from '@/lib/format';
import {
  useAuth,
  type BookRecordEntry,
  type ITHeadDashboard,
  type LoanRecord,
  type MemberRecord,
  type PermissionRequestRecord,
  type SupportTicketRecord,
} from '@/providers/AuthProvider';

import { AccessControl } from '../components/AccessControl';
import { BookRecords } from '../components/BookRecords';
import { FeeStatus } from '../components/FeeStatus';
import { IssueResolution } from '../components/IssueResolution';
import { LateReturnFines } from '../components/LateReturnFines';
import { LogBookChangeModal } from '../components/LogBookChangeModal';
import { ResolveTicketModal } from '../components/ResolveTicketModal';

const STAFF_ROLES = new Set(['member', 'manager']);

export function ITHeadDashboardPage() {
  const { t } = useTranslation();
  const {
    getITHeadDashboard,
    getMembers,
    getPermissionRequests,
    getStaffSupportTickets,
    getLoanFines,
    getBookRecords,
  } = useAuth();

  const [dashboard, setDashboard] = useState<ITHeadDashboard | null>(null);
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [permissionRequests, setPermissionRequests] = useState<PermissionRequestRecord[]>([]);
  const [tickets, setTickets] = useState<SupportTicketRecord[]>([]);
  const [fines, setFines] = useState<LoanRecord[]>([]);
  const [bookRecords, setBookRecords] = useState<BookRecordEntry[]>([]);
  const [resolvingTicket, setResolvingTicket] = useState<SupportTicketRecord | null>(null);
  const [logBookChangeOpen, setLogBookChangeOpen] = useState(false);

  function refreshDashboard() {
    getITHeadDashboard()
      .then(setDashboard)
      .catch(() => setDashboard(null));
  }

  function refreshAccessControl() {
    getMembers({ page_size: 100 })
      .then((data) => setMembers(data.items.filter((member) => STAFF_ROLES.has(member.role.name))))
      .catch(() => setMembers([]));
    getPermissionRequests()
      .then(setPermissionRequests)
      .catch(() => setPermissionRequests([]));
  }

  function refreshTickets() {
    getStaffSupportTickets()
      .then(setTickets)
      .catch(() => setTickets([]));
  }

  function refreshFines() {
    getLoanFines()
      .then(setFines)
      .catch(() => setFines([]));
  }

  function refreshBookRecords() {
    getBookRecords()
      .then(setBookRecords)
      .catch(() => setBookRecords([]));
  }

  useEffect(refreshDashboard, [getITHeadDashboard]);
  useEffect(refreshAccessControl, [getMembers, getPermissionRequests]);
  useEffect(refreshTickets, [getStaffSupportTickets]);
  useEffect(refreshFines, [getLoanFines]);
  useEffect(refreshBookRecords, [getBookRecords]);

  const stats = dashboard?.stats;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('itHead.pageTitle')} description={t('itHead.pageDescription')} />

      <h2 className="sr-only">{t('common.dashboardSectionsHeading')}</h2>

      {stats && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <StatisticCard
            icon={Users}
            label={t('itHead.stats.activeMembers')}
            value={String(stats.active_members)}
          />
          <StatisticCard
            icon={AlertCircle}
            label={t('itHead.stats.openIssues')}
            value={String(stats.open_issues)}
          />
          <StatisticCard
            icon={KeyRound}
            label={t('itHead.stats.pendingPermissions')}
            value={String(stats.pending_permissions)}
          />
          <StatisticCard
            icon={IndianRupee}
            label={t('itHead.stats.feesOutstanding')}
            value={formatCurrency(stats.fees_outstanding)}
          />
          <StatisticCard
            icon={Clock}
            label={t('itHead.stats.lateFinesOutstanding')}
            value={formatCurrency(stats.late_fines_outstanding)}
          />
        </div>
      )}

      <AccessControl
        members={members}
        permissionRequests={permissionRequests}
        onChanged={() => {
          refreshAccessControl();
          refreshDashboard();
        }}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <IssueResolution tickets={tickets} onResolveClick={setResolvingTicket} />
        <BookRecords records={bookRecords} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <FeeStatus entries={dashboard?.fee_status ?? []} />
        <LateReturnFines
          entries={fines}
          onChanged={() => {
            refreshFines();
            refreshDashboard();
          }}
        />
      </div>

      <QuickActionsCard
        actions={[
          {
            label: t('itHead.quickActions.logBookChange'),
            icon: UploadCloud,
            onClick: () => setLogBookChangeOpen(true),
          },
        ]}
      />

      <ResolveTicketModal
        ticket={resolvingTicket}
        onClose={() => setResolvingTicket(null)}
        onResolved={() => {
          refreshTickets();
          refreshDashboard();
        }}
      />

      <LogBookChangeModal
        open={logBookChangeOpen}
        onClose={() => setLogBookChangeOpen(false)}
        onLogged={refreshBookRecords}
      />
    </div>
  );
}
