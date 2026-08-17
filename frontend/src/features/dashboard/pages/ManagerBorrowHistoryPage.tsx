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
  return <Badge variant={variant}>{t(`managerDashboard.borrowHistory.status.${status}`)}</Badge>;
}

// Full loan ledger (active, overdue, and returned) for staff — the "Books Out on
// Loan" widget on the dashboard only shows what's currently active.
export function ManagerBorrowHistoryPage() {
  const { t } = useTranslation();
  const { getLoanHistory } = useAuth();
  const [loans, setLoans] = useState<LoanRecord[]>([]);

  useEffect(() => {
    getLoanHistory()
      .then(setLoans)
      .catch(() => setLoans([]));
  }, [getLoanHistory]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('managerDashboard.borrowHistory.pageTitle')}
        description={t('managerDashboard.borrowHistory.pageDescription')}
      />

      {loans.length === 0 ? (
        <NoResults
          icon={History}
          title={t('managerDashboard.borrowHistory.empty.title')}
          description={t('managerDashboard.borrowHistory.empty.description')}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('managerDashboard.borrowHistory.table.book')}</TableHead>
              <TableHead>{t('managerDashboard.borrowHistory.table.member')}</TableHead>
              <TableHead>{t('managerDashboard.borrowHistory.table.borrowed')}</TableHead>
              <TableHead>{t('managerDashboard.borrowHistory.table.due')}</TableHead>
              <TableHead>{t('managerDashboard.borrowHistory.table.returned')}</TableHead>
              <TableHead>{t('managerDashboard.borrowHistory.table.status')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loans.map((loan) => (
              <TableRow key={loan.id}>
                <TableCell>
                  <p className="font-medium text-foreground">{loan.book_title}</p>
                </TableCell>
                <TableCell>{loan.member_name}</TableCell>
                <TableCell>{formatDate(loan.borrowed_at)}</TableCell>
                <TableCell>{formatDate(loan.due_date)}</TableCell>
                <TableCell>
                  {formatDate(loan.returned_at) ?? t('managerDashboard.borrowHistory.notReturned')}
                </TableCell>
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
