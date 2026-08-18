import { SearchX, ShieldCheck, ShieldOff } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { PageHeader, Pagination } from '@/components/common';
import { ErrorState, LoadingState, NoResults } from '@/components/feedback';
import {
  Avatar,
  Badge,
  Button,
  ConfirmDialog,
  SearchBar,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui';
import { getErrorMessage } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import { useDebouncedFetch } from '@/lib/useDebouncedFetch';
import {
  useAuth,
  type AdminMemberRecord,
  type AdminMemberSortBy,
  type AdminMemberStatusFilter,
  type Role,
  type SortDirection,
} from '@/providers/AuthProvider';

const PAGE_SIZE = 10;
const ROLES: Role[] = ['member', 'librarian', 'manager', 'it-head', 'guardian', 'admin'];
const EMPTY_MEMBER_LIST = { items: [] as AdminMemberRecord[], total: 0 };

type PendingMemberAction =
  | { kind: 'role'; member: AdminMemberRecord; roleName: string }
  | { kind: 'deactivate'; member: AdminMemberRecord };

const STATUS_FILTERS: { value: AdminMemberStatusFilter | 'all'; labelKey: string }[] = [
  { value: 'all', labelKey: 'admin.members.filters.statusAll' },
  { value: 'active', labelKey: 'admin.members.filters.statusActive' },
  { value: 'inactive', labelKey: 'admin.members.filters.statusInactive' },
];

const SORT_OPTIONS: { value: `${AdminMemberSortBy}-${SortDirection}`; labelKey: string }[] = [
  { value: 'joined-desc', labelKey: 'admin.members.sort.joinedDesc' },
  { value: 'joined-asc', labelKey: 'admin.members.sort.joinedAsc' },
  { value: 'name-asc', labelKey: 'admin.members.sort.nameAsc' },
  { value: 'name-desc', labelKey: 'admin.members.sort.nameDesc' },
  { value: 'role-asc', labelKey: 'admin.members.sort.roleAsc' },
];

function LastPaymentCell({ member }: { member: AdminMemberRecord }) {
  const { t } = useTranslation();
  if (member.last_payment_amount === null || member.last_payment_at === null) {
    return <span className="text-muted-foreground">{t('admin.members.noPayment')}</span>;
  }
  return (
    <div>
      <p className="font-medium text-foreground">{formatCurrency(member.last_payment_amount)}</p>
      <p className="text-xs text-muted-foreground">
        {member.last_payment_label} · {formatDate(member.last_payment_at)}
      </p>
    </div>
  );
}

function PlanCell({ member }: { member: AdminMemberRecord }) {
  const { t } = useTranslation();
  if (member.plan_label === null || member.plan_expires_at === null) {
    return <span className="text-muted-foreground">{t('admin.members.noPlan')}</span>;
  }
  return (
    <div>
      <p className="font-medium text-foreground">{member.plan_label}</p>
      <p className="text-xs text-muted-foreground">
        {t(member.plan_is_active ? 'admin.members.planActiveUntil' : 'admin.members.planExpired', {
          date: formatDate(member.plan_expires_at),
        })}
      </p>
    </div>
  );
}

function ProgressCell({ member }: { member: AdminMemberRecord }) {
  const { t } = useTranslation();
  if (member.books_reading === 0 && member.books_completed === 0) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <div className="text-xs text-muted-foreground">
      {member.books_reading > 0 && (
        <p>{t('admin.members.booksReading', { count: member.books_reading })}</p>
      )}
      {member.books_completed > 0 && (
        <p>{t('admin.members.booksCompleted', { count: member.books_completed })}</p>
      )}
    </div>
  );
}

function EventsCell({ member }: { member: AdminMemberRecord }) {
  const { t } = useTranslation();
  if (member.event_registrations === 0) {
    return <span className="text-muted-foreground">—</span>;
  }
  return <span>{t('admin.members.eventsCount', { count: member.event_registrations })}</span>;
}

export function AdminMembersPage() {
  const { t } = useTranslation();
  const { getAdminMembers, updateAdminMember } = useAuth();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<Role | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<AdminMemberStatusFilter | 'all'>('all');
  const [sort, setSort] = useState<`${AdminMemberSortBy}-${SortDirection}`>('joined-desc');
  const [page, setPage] = useState(1);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingMemberAction | null>(null);

  const [sortBy, sortDir] = sort.split('-') as [AdminMemberSortBy, SortDirection];

  const {
    data,
    isLoading,
    error: loadError,
    refresh,
  } = useDebouncedFetch(
    () =>
      getAdminMembers({
        search,
        page,
        page_size: PAGE_SIZE,
        role: roleFilter === 'all' ? undefined : roleFilter,
        status: statusFilter === 'all' ? undefined : statusFilter,
        sort_by: sortBy,
        sort_dir: sortDir,
      }),
    [search, roleFilter, statusFilter, sortBy, sortDir, page, getAdminMembers],
    EMPTY_MEMBER_LIST,
  );
  const { items, total } = data;

  function updateSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  function updateRoleFilter(value: string) {
    setRoleFilter(value as Role | 'all');
    setPage(1);
  }

  function updateStatusFilter(value: string) {
    setStatusFilter(value as AdminMemberStatusFilter | 'all');
    setPage(1);
  }

  function updateSort(value: string) {
    setSort(value as `${AdminMemberSortBy}-${SortDirection}`);
    setPage(1);
  }

  function changeRole(member: AdminMemberRecord, roleName: string) {
    if (roleName === member.role) return;
    setPendingAction({ kind: 'role', member, roleName });
  }

  async function confirmPendingAction() {
    if (!pendingAction) return;
    const { member } = pendingAction;
    setUpdatingId(member.id);
    try {
      if (pendingAction.kind === 'role') {
        await updateAdminMember(member.id, { role_name: pendingAction.roleName });
        toast.success(
          t('admin.members.toasts.roleUpdated', {
            name: member.full_name,
            role: pendingAction.roleName,
          }),
        );
      } else {
        await updateAdminMember(member.id, { is_active: false });
        toast.success(t('admin.members.toasts.deactivated', { name: member.full_name }));
      }
      setPendingAction(null);
      refresh();
    } catch (error) {
      toast.error(getErrorMessage(error, t('common.errors.generic')));
    } finally {
      setUpdatingId(null);
    }
  }

  async function toggleActive(member: AdminMemberRecord) {
    if (member.is_active) {
      setPendingAction({ kind: 'deactivate', member });
      return;
    }
    setUpdatingId(member.id);
    try {
      await updateAdminMember(member.id, { is_active: !member.is_active });
      toast.success(t('admin.members.toasts.activated', { name: member.full_name }));
      refresh();
    } catch (error) {
      toast.error(getErrorMessage(error, t('common.errors.generic')));
    } finally {
      setUpdatingId(null);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('admin.members.pageTitle')}
        description={t('admin.members.pageDescription')}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <SearchBar
          value={search}
          onChange={updateSearch}
          placeholder={t('admin.members.searchPlaceholder')}
          className="max-w-sm"
        />

        <Select
          label={t('admin.members.filters.roleLabel')}
          value={roleFilter}
          onChange={(event) => updateRoleFilter(event.target.value)}
          className="w-full sm:w-44"
          options={[
            { value: 'all', label: t('admin.members.filters.roleAll') },
            ...ROLES.map((role) => ({ value: role, label: t(`auth.login.roles.${role}`) })),
          ]}
        />

        <Select
          label={t('admin.members.filters.statusLabel')}
          value={statusFilter}
          onChange={(event) => updateStatusFilter(event.target.value)}
          className="w-full sm:w-40"
          options={STATUS_FILTERS.map((option) => ({
            value: option.value,
            label: t(option.labelKey),
          }))}
        />

        <Select
          label={t('admin.members.sort.label')}
          value={sort}
          onChange={(event) => updateSort(event.target.value)}
          className="w-full sm:w-48"
          options={SORT_OPTIONS.map((option) => ({
            value: option.value,
            label: t(option.labelKey),
          }))}
        />
      </div>

      {isLoading && items.length === 0 ? (
        <LoadingState label="Loading members" />
      ) : loadError ? (
        <ErrorState
          className="min-h-48"
          description={getErrorMessage(loadError, t('common.errors.generic'))}
          onRetry={refresh}
        />
      ) : items.length === 0 ? (
        <NoResults
          icon={SearchX}
          title={t('admin.members.empty.title')}
          description={t('admin.members.empty.description')}
        />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('admin.members.table.member')}</TableHead>
                <TableHead>{t('admin.members.table.role')}</TableHead>
                <TableHead>{t('admin.members.table.lastPayment')}</TableHead>
                <TableHead>{t('admin.members.table.plan')}</TableHead>
                <TableHead>{t('admin.members.table.progress')}</TableHead>
                <TableHead>{t('admin.members.table.reported')}</TableHead>
                <TableHead>{t('admin.members.table.joined')}</TableHead>
                <TableHead>{t('admin.members.table.events')}</TableHead>
                <TableHead>{t('admin.members.table.status')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar name={member.full_name} size="sm" />
                      <div>
                        <p className="font-medium text-foreground">{member.full_name}</p>
                        <p className="text-xs text-muted-foreground">{member.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <select
                      value={member.role}
                      disabled={updatingId === member.id}
                      onChange={(event) => changeRole(member, event.target.value)}
                      aria-label={t('admin.members.roleSelectLabel', { name: member.full_name })}
                      className="rounded border border-border bg-surface px-2 py-1 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
                    >
                      {ROLES.map((role) => (
                        <option key={role} value={role}>
                          {t(`auth.login.roles.${role}`)}
                        </option>
                      ))}
                    </select>
                  </TableCell>
                  <TableCell>
                    <LastPaymentCell member={member} />
                  </TableCell>
                  <TableCell>
                    <PlanCell member={member} />
                  </TableCell>
                  <TableCell>
                    <ProgressCell member={member} />
                  </TableCell>
                  <TableCell>
                    <Badge variant={member.reported ? 'danger' : 'outline'}>
                      {t(
                        member.reported ? 'admin.members.reportedYes' : 'admin.members.reportedNo',
                      )}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate(member.joined_at)}</TableCell>
                  <TableCell>
                    <EventsCell member={member} />
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant={member.is_active ? 'danger' : 'success'}
                      isLoading={updatingId === member.id}
                      leadingIcon={
                        member.is_active ? (
                          <ShieldOff className="size-3.5" />
                        ) : (
                          <ShieldCheck className="size-3.5" />
                        )
                      }
                      onClick={() => toggleActive(member)}
                    >
                      {t(
                        member.is_active
                          ? 'admin.members.actions.deactivate'
                          : 'admin.members.actions.activate',
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={total}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </>
      )}

      <ConfirmDialog
        open={pendingAction !== null}
        title={t(
          pendingAction?.kind === 'role'
            ? 'admin.members.confirmRole.title'
            : 'admin.members.confirmDeactivate.title',
        )}
        description={
          pendingAction?.kind === 'role'
            ? t('admin.members.confirmRole.description', {
                name: pendingAction.member.full_name,
                currentRole: t(`auth.login.roles.${pendingAction.member.role}`),
                nextRole: t(`auth.login.roles.${pendingAction.roleName}`),
              })
            : t('admin.members.confirmDeactivate.description', {
                name: pendingAction?.member.full_name ?? '',
              })
        }
        confirmLabel={t(
          pendingAction?.kind === 'role'
            ? 'admin.members.confirmRole.confirm'
            : 'admin.members.actions.deactivate',
        )}
        cancelLabel={t('common.actions.cancel')}
        onCancel={() => setPendingAction(null)}
        onConfirm={confirmPendingAction}
        isLoading={updatingId !== null}
        destructive={pendingAction?.kind === 'deactivate'}
      />
    </div>
  );
}
