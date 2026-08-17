import { SearchX } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PageHeader } from '@/components/common';
import { NoResults } from '@/components/feedback';
import {
  Avatar,
  Badge,
  Pagination,
  SearchBar,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui';
import { formatCurrency } from '@/lib/format';
import { useDebouncedFetch } from '@/lib/useDebouncedFetch';
import { useAuth, type AdminPaymentRecord } from '@/providers/AuthProvider';

const PAGE_SIZE = 20;
const EMPTY_PAYMENT_LIST = { items: [] as AdminPaymentRecord[], total: 0 };

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function AdminPaymentsPage() {
  const { t } = useTranslation();
  const { getAdminPayments } = useAuth();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data } = useDebouncedFetch(
    () => getAdminPayments({ search, page, page_size: PAGE_SIZE }),
    [search, page, getAdminPayments],
    EMPTY_PAYMENT_LIST,
  );
  const { items, total } = data;

  function updateSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('admin.payments.pageTitle')}
        description={t('admin.payments.pageDescription')}
      />

      <SearchBar
        value={search}
        onChange={updateSearch}
        placeholder={t('admin.payments.searchPlaceholder')}
        className="max-w-sm"
      />

      {items.length === 0 ? (
        <NoResults
          icon={SearchX}
          title={t('admin.payments.empty.title')}
          description={t('admin.payments.empty.description')}
        />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('admin.payments.table.member')}</TableHead>
                <TableHead>{t('admin.payments.table.amount')}</TableHead>
                <TableHead>{t('admin.payments.table.label')}</TableHead>
                <TableHead>{t('admin.payments.table.status')}</TableHead>
                <TableHead>{t('admin.payments.table.date')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar name={payment.member_name} size="sm" />
                      <div>
                        <p className="font-medium text-foreground">{payment.member_name}</p>
                        <p className="text-xs text-muted-foreground">{payment.member_email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium text-foreground">
                    {formatCurrency(payment.amount)}
                  </TableCell>
                  <TableCell>{payment.label}</TableCell>
                  <TableCell>
                    <Badge variant={payment.status === 'success' ? 'success' : 'outline'}>
                      {payment.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate(payment.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
