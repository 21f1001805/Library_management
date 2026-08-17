import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { Badge, Button, Card, CardContent, CardHeader, CardTitle, EmptyState } from '@/components/ui';
import { getErrorMessage } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import { type LoanRecord } from '@/providers/AuthProvider';

export interface ActiveLoansProps {
  loans: LoanRecord[];
  onReturn: (id: string) => Promise<unknown>;
  onRemind: (id: string) => Promise<unknown>;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function ActiveLoans({ loans, onReturn, onRemind }: ActiveLoansProps) {
  const { t } = useTranslation();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleReturn(loan: LoanRecord) {
    setBusyId(loan.id);
    try {
      await onReturn(loan.id);
      toast.success(t('managerDashboard.activeLoans.returnedToast', { name: loan.member_name }));
    } catch (err) {
      toast.error(getErrorMessage(err, t('common.errors.generic')));
    } finally {
      setBusyId(null);
    }
  }

  async function handleRemind(loan: LoanRecord) {
    setBusyId(loan.id);
    try {
      await onRemind(loan.id);
      toast.success(t('managerDashboard.activeLoans.reminderToast', { name: loan.member_name }));
    } catch (err) {
      toast.error(getErrorMessage(err, t('common.errors.generic')));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('managerDashboard.activeLoans.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        {loans.length === 0 ? (
          <EmptyState
            title={t('managerDashboard.activeLoans.emptyTitle')}
            description={t('managerDashboard.activeLoans.emptyDescription')}
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {loans.map((loan) => (
              <li
                key={loan.id}
                className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{loan.book_title}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('managerDashboard.activeLoans.borrowedBy', { name: loan.member_name })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t('managerDashboard.activeLoans.dueDate', { date: formatDate(loan.due_date) })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {loan.status === 'overdue' && (
                    <>
                      <Badge variant="danger">
                        {t('managerDashboard.activeLoans.daysLate', { count: loan.days_late })}
                      </Badge>
                      <span className="text-sm font-medium text-foreground">
                        {formatCurrency(loan.fine_amount)}
                      </span>
                    </>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    isLoading={busyId === loan.id}
                    onClick={() => handleRemind(loan)}
                  >
                    {t('managerDashboard.activeLoans.sendReminder')}
                  </Button>
                  <Button size="sm" isLoading={busyId === loan.id} onClick={() => handleReturn(loan)}>
                    {t('managerDashboard.activeLoans.markReturned')}
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
