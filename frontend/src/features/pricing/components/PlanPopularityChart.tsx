'use client';

import { useTranslation } from 'react-i18next';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui';

// Decorative trend only — this app doesn't track plan interest, so the series is illustrative.
// Each plan gets its own shape so the four cards don't render an identical chart.
const POPULARITY_TREND_BY_PLAN: Record<string, number[]> = {
  '1m': [30, 38, 35, 44, 41, 52],
  '3m': [40, 55, 48, 66, 74, 90],
  '6m': [50, 47, 60, 58, 72, 80],
  '12m': [35, 42, 58, 55, 70, 95],
};
const WEEK_LABELS = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6'];

export interface PlanPopularityChartProps {
  planId: string;
}

export function PlanPopularityChart({ planId }: PlanPopularityChartProps) {
  const { t } = useTranslation();
  const trend = POPULARITY_TREND_BY_PLAN[planId] ?? POPULARITY_TREND_BY_PLAN['1m'];
  const data = trend.map((interest, i) => ({ week: WEEK_LABELS[i], interest }));

  return (
    <Card className="bg-secondary/40">
      <CardHeader className="space-y-0 border-b border-border p-3">
        <CardTitle className="text-sm">{t('pricing.popularity.title')}</CardTitle>
        <CardDescription className="text-xs">{t('pricing.popularity.subtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="h-28 p-3">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, left: 0, right: 8, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--color-border-muted)" />
            <XAxis
              dataKey="week"
              tickLine={false}
              axisLine={false}
              tickMargin={6}
              fontSize={10}
              stroke="var(--color-muted-foreground)"
            />
            <Tooltip
              cursor={false}
              contentStyle={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--color-foreground)',
                fontSize: 12,
              }}
              labelStyle={{ color: 'var(--color-muted-foreground)' }}
            />
            <Line
              dataKey="interest"
              type="monotone"
              stroke="var(--color-primary)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
