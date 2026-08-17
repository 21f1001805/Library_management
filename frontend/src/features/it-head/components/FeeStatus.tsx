import { useTranslation } from 'react-i18next';

import { NoResults } from '@/components/feedback';
import { Badge, type BadgeVariant, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { formatCurrency } from '@/lib/format';
import type { FeeStatusEntryRecord } from '@/providers/AuthProvider';

const statusBadgeVariant: Record<FeeStatusEntryRecord['status'], BadgeVariant> = {
  paid: 'success',
  due: 'warning',
  overdue: 'danger',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function FeeStatus({ entries }: { entries: FeeStatusEntryRecord[] }) {
  const { t } = useTranslation();
  // Only members who owe something are worth showing here — a long "paid" list adds
  // no value on a dashboard whose whole point is surfacing what needs attention.
  const outstanding = entries.filter((entry) => entry.status !== 'paid');

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('itHead.feeStatus.title')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {outstanding.length === 0 ? (
          <NoResults title={t('itHead.feeStatus.empty')} />
        ) : (
          outstanding.map((entry) => (
            <div
              key={entry.member_id}
              className="flex flex-col gap-2 rounded-lg border border-border p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium text-foreground">{entry.member_name}</p>
                {entry.due_date && (
                  <p className="text-xs text-muted-foreground">
                    {t('itHead.feeStatus.dueDate', { date: formatDate(entry.due_date) })}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">
                  {formatCurrency(entry.amount_due)}
                </span>
                <Badge variant={statusBadgeVariant[entry.status]}>
                  {t(`itHead.feeStatus.status.${entry.status}`)}
                </Badge>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
