import { TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui';
import { cn } from '@/lib/cn';

export interface StatisticTrend {
  direction: 'up' | 'down';
  percent: number;
  /** Color the trend green/red by real-world sentiment, not just arrow direction — a drop in
   * expenses is good news. Defaults to matching direction (up = positive, down = negative). */
  sentiment?: 'positive' | 'negative';
}

export interface StatisticCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  trend?: StatisticTrend;
  className?: string;
}

export function StatisticCard({ icon: Icon, label, value, trend, className }: StatisticCardProps) {
  const { t } = useTranslation();
  const sentiment = trend ? (trend.sentiment ?? (trend.direction === 'up' ? 'positive' : 'negative')) : null;

  return (
    <Card className={cn('flex items-center gap-3.5 p-5', className)}>
      <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-5" />
      </span>
      {/* min-w-0: without it, a long label (e.g. "Late Fines Outstanding") sets the flex
          item's minimum width to its unwrapped text width, pushing the card past its grid
          column instead of wrapping. */}
      <div className="min-w-0">
        <p className="text-2xl font-semibold tracking-tight text-foreground">{value}</p>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        {trend && (
          <p
            className={cn(
              'mt-1 flex items-center gap-1 text-xs font-medium',
              sentiment === 'positive' ? 'text-success' : 'text-danger',
            )}
          >
            {trend.direction === 'up' ? (
              <TrendingUp className="size-3.5" aria-hidden="true" />
            ) : (
              <TrendingDown className="size-3.5" aria-hidden="true" />
            )}
            {trend.percent}%
            <span className="font-normal text-muted-foreground">
              {t('common.trend.vsLastMonth')}
            </span>
          </p>
        )}
      </div>
    </Card>
  );
}
