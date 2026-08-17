import { History } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PageHeader } from '@/components/common';
import { NoResults } from '@/components/feedback';
import {
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui';
import { useAuth, type LoanRecord } from '@/providers/AuthProvider';

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function StatusBadge({ status }: { status: LoanRecord['status'] }) {
  const { t } = useTranslation();
  const variant = status === 'overdue' ? 'warning' : status === 'returned' ? 'default' : 'success';
  return <Badge variant={variant}>{t(`myLoans.status.${status}`)}</Badge>;
}

// Member's own borrowing history — read-only, scoped to the signed-in member by
// the backend (/loans/me), so there is nothing to search or filter by member.
export function MyBorrowHistoryPage() {
  const { t } = useTranslation();
  const { getMyLoans } = useAuth();
  const [loans, setLoans] = useState<LoanRecord[]>([]);

  useEffect(() => {
    getMyLoans()
      .then(setLoans)
      .catch(() => setLoans([]));
  }, [getMyLoans]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('myLoans.pageTitle')} description={t('myLoans.pageDescription')} />

      {loans.length === 0 ? (
        <NoResults
          icon={History}
          title={t('myLoans.empty.title')}
          description={t('myLoans.empty.description')}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('myLoans.table.book')}</TableHead>
              <TableHead>{t('myLoans.table.borrowed')}</TableHead>
              <TableHead>{t('myLoans.table.due')}</TableHead>
              <TableHead>{t('myLoans.table.returned')}</TableHead>
              <TableHead>{t('myLoans.table.status')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loans.map((loan) => (
              <TableRow key={loan.id}>
                <TableCell>
                  <p className="font-medium text-foreground">{loan.book_title}</p>
                </TableCell>
                <TableCell>{formatDate(loan.borrowed_at)}</TableCell>
                <TableCell>{formatDate(loan.due_date)}</TableCell>
                <TableCell>{formatDate(loan.returned_at) ?? t('myLoans.notReturned')}</TableCell>
                <TableCell>
                  <StatusBadge status={loan.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
