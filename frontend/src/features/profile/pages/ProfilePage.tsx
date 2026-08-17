import {
  AlertCircle,
  Armchair,
  Award,
  BookOpen,
  ClipboardList,
  Clock,
  FileText,
  IndianRupee,
  KeyRound,
  TicketCheck,
  UserPlus,
  Wallet,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ProgressBar, StatisticCard } from '@/components/common';
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState } from '@/components/ui';
import { formatCurrency } from '@/lib/format';
import { guardianStats } from '@/mocks/guardian';
import type { RegistrationRequest, WalkInRequest } from '@/mocks/manager';
import {
  useAuth,
  type AuditLogEntry,
  type GuardianChild,
  type MemberRecord,
  type Membership,
  type PaymentRecord,
  type PermissionRequestRecord,
  type ReadingProgressEntry,
  type SupportTicketRecord,
} from '@/providers/AuthProvider';

import { AuditLog } from '@/features/admin/components/AuditLog';
import { NewRegistrations } from '@/features/dashboard/components/NewRegistrations';
import { RegisterMemberModal } from '@/features/dashboard/components/RegisterMemberModal';
import { WalkInAssistance } from '@/features/dashboard/components/WalkInAssistance';
import { BorrowedBooksByChild } from '@/features/guardian/components/BorrowedBooksByChild';
import { ChildrenPresence } from '@/features/guardian/components/ChildrenPresence';
import { AccessControl } from '@/features/it-head/components/AccessControl';
import { IssueResolution } from '@/features/it-head/components/IssueResolution';
import { ResolveTicketModal } from '@/features/it-head/components/ResolveTicketModal';

import { ProfileHeader } from '../components/ProfileHeader';

// No online flow yet lets a visitor submit a walk-in/registration request, so
// these queues have nothing real to show — kept empty rather than mocked
// (mirrors ManagerDashboard.tsx, the primary manager view for this).
const NO_WALK_INS: WalkInRequest[] = [];
const NO_REGISTRATIONS: RegistrationRequest[] = [];

function AdminProfile() {
  const { t } = useTranslation();
  const { userId, getAuditLog } = useAuth();
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);

  useEffect(() => {
    getAuditLog().then(setEntries).catch(() => setEntries([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const myActivity = useMemo(
    () => entries.filter((entry) => entry.actor_id === userId),
    [entries, userId],
  );
  const expensesApproved = myActivity.filter((entry) => entry.action === 'expenseApproved').length;
  const feesWaived = myActivity.filter((entry) => entry.action === 'feeWaived').length;

  return (
    <div className="flex flex-col gap-6">
      <ProfileHeader name={t('auth.login.roles.admin')} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatisticCard
          icon={ClipboardList}
          label={t('profile.adminStats.actionsThisMonth')}
          value={String(myActivity.length)}
        />
        <StatisticCard
          icon={IndianRupee}
          label={t('profile.adminStats.expensesApproved')}
          value={String(expensesApproved)}
        />
        <StatisticCard
          icon={Wallet}
          label={t('profile.adminStats.finesWaived')}
          value={String(feesWaived)}
        />
      </div>

      <AuditLog entries={myActivity} />
    </div>
  );
}

// ponytail: GuardianChild has no presence/loan/fine fields server-side yet —
// linkedChildren is overridden with the real count, ChildrenPresence/
// BorrowedBooksByChild get empty arrays and show their honest empty states
// instead of fabricated per-child data (mirrors GuardianDashboardPage).
function GuardianProfile() {
  const { t } = useTranslation();
  const { getGuardianChildren } = useAuth();
  const [realChildren, setRealChildren] = useState<GuardianChild[]>([]);

  useEffect(() => {
    getGuardianChildren().then(setRealChildren).catch(() => setRealChildren([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <ProfileHeader name={t('auth.login.roles.guardian')} />

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

      <ChildrenPresence children={[]} />
      <BorrowedBooksByChild books={[]} children={[]} />
    </div>
  );
}

function ManagerProfile() {
  const { t } = useTranslation();
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <ProfileHeader name={t('auth.login.roles.manager')} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatisticCard
          icon={Armchair}
          label={t('profile.managerStats.walkInRequests')}
          value={String(NO_WALK_INS.length)}
        />
        <StatisticCard
          icon={UserPlus}
          label={t('profile.managerStats.newRegistrations')}
          value={String(NO_REGISTRATIONS.length)}
        />
        <StatisticCard
          icon={IndianRupee}
          label={t('profile.managerStats.pendingPayments')}
          value="0"
        />
      </div>

      <WalkInAssistance requests={NO_WALK_INS} />
      <NewRegistrations requests={NO_REGISTRATIONS} onRegister={() => setIsRegisterOpen(true)} />

      <RegisterMemberModal
        open={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        onRegistered={() => {}}
      />
    </div>
  );
}

const IT_HEAD_ACCESS_ROLES = new Set(['member', 'manager']);

function ITHeadProfile() {
  const { t } = useTranslation();
  const { getMembers, getPermissionRequests, getStaffSupportTickets } = useAuth();
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [permissionRequests, setPermissionRequests] = useState<PermissionRequestRecord[]>([]);
  const [tickets, setTickets] = useState<SupportTicketRecord[]>([]);
  const [resolvingTicket, setResolvingTicket] = useState<SupportTicketRecord | null>(null);

  function refreshAccessControl() {
    getMembers({ page_size: 100 })
      .then((data) => setMembers(data.items.filter((m) => IT_HEAD_ACCESS_ROLES.has(m.role.name))))
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

  useEffect(refreshAccessControl, [getMembers, getPermissionRequests]);
  useEffect(refreshTickets, [getStaffSupportTickets]);

  const openIssues = useMemo(() => tickets.filter((t) => t.status === 'open').length, [tickets]);
  const resolvedIssues = useMemo(
    () => tickets.filter((t) => t.status === 'resolved').length,
    [tickets],
  );
  const pendingPermissions = useMemo(
    () => permissionRequests.filter((r) => r.status === 'pending').length,
    [permissionRequests],
  );

  return (
    <div className="flex flex-col gap-6">
      <ProfileHeader name={t('auth.login.roles.it-head')} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatisticCard
          icon={AlertCircle}
          label={t('profile.itHeadStats.openIssues')}
          value={String(openIssues)}
        />
        <StatisticCard
          icon={TicketCheck}
          label={t('profile.itHeadStats.resolvedIssues')}
          value={String(resolvedIssues)}
        />
        <StatisticCard
          icon={KeyRound}
          label={t('profile.itHeadStats.pendingPermissions')}
          value={String(pendingPermissions)}
        />
      </div>

      <AccessControl
        members={members}
        permissionRequests={permissionRequests}
        onChanged={refreshAccessControl}
      />
      <IssueResolution tickets={tickets} onResolveClick={setResolvingTicket} />

      <ResolveTicketModal
        ticket={resolvingTicket}
        onClose={() => setResolvingTicket(null)}
        onResolved={refreshTickets}
      />
    </div>
  );
}

function formatJoinDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function formatPaymentDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ponytail: booksRead comes from real ReadingProgress (status=completed); pagesRead
// and hoursRead have no tracking source at all (no page counts, no time tracking)
// so they show honest zeros instead of fabricated numbers. Achievements and borrow
// history have no backend yet (gamification/Loan out of scope for now) — honest
// empty states rather than the old mock badges/table rows.
function MemberProfile() {
  const { t } = useTranslation();
  const { fullName, email, getMembership, getMyReadingProgress, getMyPayments } = useAuth();
  const [membership, setMembership] = useState<Membership | null>(null);
  const [progress, setProgress] = useState<ReadingProgressEntry[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);

  useEffect(() => {
    getMembership().then(setMembership).catch(() => setMembership(null));
    getMyReadingProgress().then(setProgress).catch(() => setProgress([]));
    getMyPayments().then(setPayments).catch(() => setPayments([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentlyReading = progress.filter((entry) => entry.status === 'reading');
  const booksRead = progress.filter((entry) => entry.status === 'completed').length;

  return (
    <div className="flex flex-col gap-6">
      <ProfileHeader
        name={fullName ?? ''}
        email={email ?? undefined}
        joinDate={membership ? formatJoinDate(membership.purchased_at) : undefined}
        planLabel={membership?.is_active ? membership.plan_label : undefined}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatisticCard icon={BookOpen} label={t('profile.stats.booksRead')} value={String(booksRead)} />
        <StatisticCard icon={FileText} label={t('profile.stats.pagesRead')} value="0" />
        <StatisticCard icon={Clock} label={t('profile.stats.hoursRead')} value="0" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('profile.paymentHistory.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <EmptyState
              icon={IndianRupee}
              title={t('profile.paymentHistory.empty.title')}
              description={t('profile.paymentHistory.empty.description')}
            />
          ) : (
            <ul className="flex flex-col gap-3">
              {payments.map((payment) => (
                <li
                  key={payment.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm"
                >
                  <div>
                    <p className="font-medium text-foreground">{payment.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatPaymentDate(payment.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">
                      {formatCurrency(payment.amount)}
                    </span>
                    <Badge variant={payment.status === 'success' ? 'success' : 'outline'}>
                      {payment.status}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('profile.achievements.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={Award}
            title={t('profile.achievements.empty.title')}
            description={t('profile.achievements.empty.description')}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('profile.currentReading.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          {currentlyReading.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title={t('readingProgress.emptyState.title')}
              description={t('readingProgress.lists.currentlyReading.emptyDescription')}
            />
          ) : (
            <div className="flex flex-col gap-4">
              {currentlyReading.map((entry) => (
                <div key={entry.id}>
                  <p className="text-sm font-medium text-foreground">{entry.book_title}</p>
                  <ProgressBar percent={entry.percent_complete} className="mt-1.5" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('profile.borrowHistory.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={ClipboardList}
            title={t('profile.borrowHistory.empty.title')}
            description={t('profile.borrowHistory.empty.description')}
          />
        </CardContent>
      </Card>
    </div>
  );
}

export function ProfilePage() {
  const { role } = useAuth();

  if (role === 'admin') return <AdminProfile />;
  if (role === 'manager') return <ManagerProfile />;
  if (role === 'it-head') return <ITHeadProfile />;
  if (role === 'guardian') return <GuardianProfile />;

  return <MemberProfile />;
}
