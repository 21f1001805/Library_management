import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { Button, Card, CardContent, CardHeader, CardTitle, EmptyState, Select } from '@/components/ui';
import { getErrorMessage } from '@/lib/api';
import { type LoanDurationDays, type PendingReservationRequest } from '@/providers/AuthProvider';

const DURATION_CHOICES: LoanDurationDays[] = [3, 5, 7, 10];

export interface PendingReservationsProps {
  requests: PendingReservationRequest[];
  onApprove: (id: string, durationDays: LoanDurationDays) => Promise<unknown>;
  onReject: (id: string) => Promise<unknown>;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function PendingReservations({ requests, onApprove, onReject }: PendingReservationsProps) {
  const { t } = useTranslation();
  const [durationByRequest, setDurationByRequest] = useState<Record<string, LoanDurationDays>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

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
      <CardContent>
        {requests.length === 0 ? (
          <EmptyState
            title={t('managerDashboard.pendingReservations.emptyTitle')}
            description={t('managerDashboard.pendingReservations.emptyDescription')}
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {requests.map((request) => (
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
        )}
      </CardContent>
    </Card>
  );
}
