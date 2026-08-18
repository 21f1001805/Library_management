import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { Pagination, TableToolbar } from '@/components/common';
import { Button, Card, CardContent, CardHeader, CardTitle, EmptyState, Select } from '@/components/ui';
import { usePagination } from '@/hooks';
import { getErrorMessage } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { type LoanDurationDays, type PendingReservationRequest } from '@/providers/AuthProvider';

const DURATION_CHOICES: LoanDurationDays[] = [3, 5, 7, 10];

export interface PendingReservationsProps {
  requests: PendingReservationRequest[];
  onApprove: (id: string, durationDays: LoanDurationDays) => Promise<unknown>;
  onReject: (id: string) => Promise<unknown>;
}

export function PendingReservations({ requests, onApprove, onReject }: PendingReservationsProps) {
  const { t } = useTranslation();
  const [durationByRequest, setDurationByRequest] = useState<Record<string, LoanDurationDays>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [sortValue, setSortValue] = useState('newest');

  const filteredRequests = useMemo(() => {
    const items = [...requests];
    switch (sortValue) {
      case 'book':
        return items.sort((a, b) => a.book_title.localeCompare(b.book_title));
      case 'member':
        return items.sort((a, b) => a.member_name.localeCompare(b.member_name));
      case 'oldest':
        return items.sort((a, b) => new Date(a.requested_at).getTime() - new Date(b.requested_at).getTime());
      case 'newest':
      default:
        return items.sort((a, b) => new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime());
    }
  }, [requests, sortValue]);

  const { page, setPage, totalPages, paginatedItems, totalItems } = usePagination(filteredRequests, 5);

  function durationFor(id: string): LoanDurationDays {
    return durationByRequest[id] ?? 7;
  }

  async function handleApprove(request: PendingReservationRequest) {
    setBusyId(request.id);
    try {
      await onApprove(request.id, durationFor(request.id));
      toast.success(
        t('managerDashboard.pendingReservations.approveToast', { name: request.member_name }),
      );
    } catch (err) {
      toast.error(getErrorMessage(err, t('common.errors.generic')));
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(request: PendingReservationRequest) {
    setBusyId(request.id);
    try {
      await onReject(request.id);
      toast.success(
        t('managerDashboard.pendingReservations.rejectToast', { name: request.member_name }),
      );
    } catch (err) {
      toast.error(getErrorMessage(err, t('common.errors.generic')));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('managerDashboard.pendingReservations.title')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <TableToolbar
          sort={{
            label: 'Sort',
            value: sortValue,
            onChange: (value) => {
              setSortValue(value);
              setPage(1);
            },
            options: [
              { value: 'newest', label: 'Newest First' },
              { value: 'oldest', label: 'Oldest First' },
              { value: 'book', label: 'Book Title' },
              { value: 'member', label: 'Member Name' },
            ],
          }}
          onReset={() => {
            setSortValue('newest');
            setPage(1);
          }}
          resetLabel={t('common.actions.reset')}
        />
        {filteredRequests.length === 0 ? (
          <EmptyState
            title={t('managerDashboard.pendingReservations.emptyTitle')}
            description={t('managerDashboard.pendingReservations.emptyDescription')}
          />
        ) : (
          <>
            <ul className="flex flex-col gap-3">
              {paginatedItems.map((request) => (
                <li
                  key={request.id}
                  className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{request.book_title}</p>
                    <p className="text-xs text-muted-foreground">
                      {t('managerDashboard.pendingReservations.requestedBy', {
                        name: request.member_name,
                      })}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatDate(request.requested_at)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={String(durationFor(request.id))}
                      onChange={(event) =>
                        setDurationByRequest((prev) => ({
                          ...prev,
                          [request.id]: Number(event.target.value) as LoanDurationDays,
                        }))
                      }
                      options={DURATION_CHOICES.map((days) => ({
                        value: String(days),
                        label: t('managerDashboard.pendingReservations.durationOption', {
                          count: days,
                        }),
                      }))}
                      className="w-auto"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      isLoading={busyId === request.id}
                      onClick={() => handleReject(request)}
                    >
                      {t('managerDashboard.pendingReservations.reject')}
                    </Button>
                    <Button size="sm" isLoading={busyId === request.id} onClick={() => handleApprove(request)}>
                      {t('managerDashboard.pendingReservations.approve')}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={totalItems}
              pageSize={5}
              onPageChange={setPage}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
