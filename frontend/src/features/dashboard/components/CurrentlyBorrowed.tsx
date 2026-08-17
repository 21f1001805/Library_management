import { BookOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { IconBadge } from '@/components/common';
import { Card, CardContent, CardHeader, CardTitle, EmptyState } from '@/components/ui';

export interface CurrentlyBorrowedBook {
  id: string;
  title: string;
  borrowedOn: string;
}

export interface CurrentlyBorrowedProps {
  books: CurrentlyBorrowedBook[];
}

export function CurrentlyBorrowed({ books }: CurrentlyBorrowedProps) {
  const { t } = useTranslation();

  return (
    <Card className="rounded-2xl shadow-panel">
      <CardHeader className="flex-row items-center gap-3 space-y-0">
        <IconBadge icon={BookOpen} size={9} />
        <CardTitle>{t('dashboard.currentlyBorrowed.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        {books.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title={t('myLoans.empty.title')}
            description={t('myLoans.empty.description')}
          />
        ) : (
          <ul className="flex flex-col gap-2.5">
            {books.map((book) => (
              <li
                key={book.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border-muted bg-secondary/10 p-3 text-sm transition-colors hover:border-primary/20"
              >
                <p className="font-medium text-foreground">{book.title}</p>
                <span className="shrink-0 text-muted-foreground">
                  {t('common.time.since', { date: book.borrowedOn })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
