import { BookOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { IconBadge } from '@/components/common';
import { Badge, type BadgeVariant, Card, CardContent, CardHeader, CardTitle, EmptyState } from '@/components/ui';
import type { Child, ChildBorrowedBook } from '@/mocks/guardian';

const statusBadgeVariant: Record<ChildBorrowedBook['status'], BadgeVariant> = {
  'on-time': 'success',
  'due-soon': 'warning',
  overdue: 'danger',
};

const statusKey: Record<ChildBorrowedBook['status'], string> = {
  'on-time': 'onTime',
  'due-soon': 'dueSoon',
  overdue: 'overdue',
};

export function BorrowedBooksByChild({
  books,
  children,
}: {
  books: ChildBorrowedBook[];
  children: Child[];
}) {
  const { t } = useTranslation();
  const childName = (childId: string) => children.find((child) => child.id === childId)?.name ?? '';

  return (
    <Card className="rounded-2xl shadow-panel">
      <CardHeader className="flex-row items-center gap-3 space-y-0">
        <IconBadge icon={BookOpen} size={9} />
        <CardTitle>{t('guardian.borrowedBooks.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        {books.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title={t('guardian.borrowedBooks.emptyTitle')}
            description={t('guardian.borrowedBooks.emptyDescription')}
          />
        ) : (
          <ul className="flex flex-col gap-2.5">
            {books.map((book) => (
              <li
                key={book.id}
                className="flex flex-col gap-2 rounded-xl border border-border-muted bg-secondary/10 p-3.5 text-sm transition-colors hover:border-primary/20 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-foreground">{book.title}</p>
                  <p className="text-muted-foreground">
                    {childName(book.childId)} · {t('guardian.borrowedBooks.dueOn', { date: book.dueDate })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {book.fineAccrued && (
                    <span className="text-xs text-muted-foreground">{book.fineAccrued}</span>
                  )}
                  <Badge variant={statusBadgeVariant[book.status]}>
                    {t(`guardian.borrowedBooks.status.${statusKey[book.status]}`)}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
