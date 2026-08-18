import { SearchX } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ExportButton, PageHeader, Pagination } from '@/components/common';
import { NoResults } from '@/components/feedback';
import {
  Avatar,
  Badge,
  SearchBar,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui';
import { formatCurrency, formatDate } from '@/lib/format';
import { useDebouncedFetch } from '@/lib/useDebouncedFetch';
import { useAuth, type AdminPaymentRecord } from '@/providers/AuthProvider';

const PAGE_SIZE = 20;
// Above the usual page size — export pulls the whole filtered month in one request
// rather than just the 20 rows currently on screen.
const EXPORT_PAGE_SIZE = 1000;
const EMPTY_PAYMENT_LIST = { items: [] as AdminPaymentRecord[], total: 0 };

export function AdminPaymentsPage() {
  const { t } = useTranslation();
  const { getAdminPayments } = useAuth();
  const [search, setSearch] = useState('');
  const [month, setMonth] = useState('');
  const [page, setPage] = useState(1);

  const { data } = useDebouncedFetch(
    () => getAdminPayments({ search, month: month || undefined, page, page_size: PAGE_SIZE }),
    [search, month, page, getAdminPayments],
    EMPTY_PAYMENT_LIST,
  );
  const { items, total } = data;

  function updateSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  function updateMonth(value: string) {
    setMonth(value);
    setPage(1);
  }

  async function loadExportRows() {
    const result = await getAdminPayments({
      search,
      month: month || undefined,
      page: 1,
      page_size: EXPORT_PAGE_SIZE,
    });
    return result.items.map((payment) => [
      payment.member_name,
      payment.member_email,
      formatCurrency(payment.amount),
      payment.label,
      payment.status,
      formatDate(payment.created_at),
    ]);
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('admin.payments.pageTitle')}
        description={t('admin.payments.pageDescription')}
        actions={
          <>
            <input
              type="month"
              value={month}
              onChange={(event) => updateMonth(event.target.value)}
              className="h-10 min-w-0 max-w-full rounded-md border border-border bg-transparent px-3 text-sm text-foreground"
              aria-label={t('admin.payments.monthFilter')}
            />
            <ExportButton
              filename="payments-report"
              title={t('admin.payments.pageTitle')}
              headers={[
                t('admin.payments.table.member'),
                t('admin.payments.table.email'),
                t('admin.payments.table.amount'),
                t('admin.payments.table.label'),
                t('admin.payments.table.status'),
                t('admin.payments.table.date'),
              ]}
              rows={loadExportRows}
            />
          </>
        }
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

          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={total}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
