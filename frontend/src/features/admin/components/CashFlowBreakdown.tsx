import { useTranslation } from 'react-i18next';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { formatCurrency } from '@/lib/format';
import type { RevenueSource } from '@/providers/AuthProvider';

export function CashFlowBreakdown({ sources }: { sources: RevenueSource[] }) {
  const { t } = useTranslation();
  const total = sources.reduce((sum, source) => sum + source.amount, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('admin.cashFlow.title')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {sources.map((source) => (
          <div key={source.source} className="flex items-center justify-between text-sm">
            <span className="text-foreground">{t(`admin.cashFlow.sources.${source.source}`)}</span>
            <span className="font-medium text-foreground">{formatCurrency(source.amount)}</span>
          </div>
        ))}
        <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-sm font-semibold">
          <span className="text-foreground">{t('admin.cashFlow.total')}</span>
          <span className="text-foreground">{formatCurrency(total)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
