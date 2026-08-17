import { useTranslation } from 'react-i18next';

import { Button, Card, CardContent, CardHeader, CardTitle, EmptyState } from '@/components/ui';
import { formatRelativeTime } from '@/lib/formatRelativeTime';
import type { AppNotificationRecord } from '@/providers/AuthProvider';

export interface PendingPaymentsProps {
  payments: AppNotificationRecord[];
  onMarkPaid: (notificationId: string) => void;
}

// Members who'd rather pay cash at the counter than online — the manager
// collects the cash here and clears the fee/fine (see the "pay at the
// library" option on the payment page, which is what creates these).
export function PendingPayments({ payments, onMarkPaid }: PendingPaymentsProps) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('managerDashboard.payments.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        {payments.length === 0 ? (
          <EmptyState
            title={t('managerDashboard.payments.emptyTitle')}
            description={t('managerDashboard.payments.emptyDescription')}
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {payments.map((payment) => (
              <li
                key={payment.id}
                className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm text-foreground">{payment.message}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatRelativeTime(payment.created_at)}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => onMarkPaid(payment.id)}>
                  {t('managerDashboard.payments.markPaid')}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
