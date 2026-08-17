import { Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { IconBadge } from '@/components/common';
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState } from '@/components/ui';
import type { DueBook } from '@/mocks/dashboard';

export interface BooksDueSoonProps {
  books: DueBook[];
}

export function BooksDueSoon({ books }: BooksDueSoonProps) {
  const { t } = useTranslation();

  return (
    <Card className="rounded-2xl shadow-panel">
      <CardHeader className="flex-row items-center gap-3 space-y-0">
        <IconBadge icon={Clock} size={9} />
        <CardTitle>{t('dashboard.booksDueSoon.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        {books.length === 0 ? (
          <EmptyState
            icon={Clock}
            title={t('dashboard.booksDueSoon.emptyTitle')}
            description={t('dashboard.booksDueSoon.emptyDescription')}
          />
        ) : (
          <ul className="flex flex-col gap-2.5">
            {books.map((book) => (
              <li
                key={book.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border-muted bg-secondary/10 p-3 text-sm transition-colors hover:border-primary/20"
              >
                <span className="font-medium text-foreground">{book.title}</span>
                <Badge variant={book.daysLeft <= 1 ? 'warning' : 'outline'} className="shrink-0">
                  {t('dashboard.booksDueSoon.due', {
                    date: book.dueDate,
                    days: t('common.time.daysLeft', { count: book.daysLeft }),
                  })}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
