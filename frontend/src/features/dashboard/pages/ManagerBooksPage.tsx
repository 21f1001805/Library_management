import { BookX } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PageHeader } from '@/components/common';
import { NoResults } from '@/components/feedback';
import {
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
import { useDebouncedFetch } from '@/lib/useDebouncedFetch';
import { useAuth, type ManagerBookAvailability } from '@/providers/AuthProvider';

const PAGE_SIZE = 20;
const EMPTY_BOOK_LIST = { items: [] as ManagerBookAvailability[], total: 0 };

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function StatusCell({ book }: { book: ManagerBookAvailability }) {
  const { t } = useTranslation();

  if (book.is_available) {
    return <Badge variant="success">{t('managerDashboard.books.status.available')}</Badge>;
  }

  return (
    <div className="flex flex-col gap-1">
      <Badge variant="warning">{t('managerDashboard.books.status.unavailable')}</Badge>
      <span className="text-xs text-muted-foreground">
        {book.expected_available_at
          ? t('managerDashboard.books.expectedBack', { date: formatDate(book.expected_available_at) })
          : t('managerDashboard.books.expectedBackUnknown')}
      </span>
    </div>
  );
}

// Read-only counter-staff view: is a book on the shelf right now, and if not,
// when is the earliest active loan on it due back (there's no due date for
// copies tied up by an online reservation, so that case shows "unknown").
export function ManagerBooksPage() {
  const { t } = useTranslation();
  const { getManagerBooks } = useAuth();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data } = useDebouncedFetch(
    () => getManagerBooks({ search, page, page_size: PAGE_SIZE }),
    [search, page, getManagerBooks],
    EMPTY_BOOK_LIST,
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
        title={t('managerDashboard.books.pageTitle')}
        description={t('managerDashboard.books.pageDescription')}
      />

      <SearchBar
        value={search}
        onChange={updateSearch}
        placeholder={t('managerDashboard.books.searchPlaceholder')}
        className="max-w-sm"
      />

      {items.length === 0 ? (
        <NoResults
          icon={BookX}
          title={t('managerDashboard.books.empty.title')}
          description={t('managerDashboard.books.empty.description')}
        />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('managerDashboard.books.table.title')}</TableHead>
                <TableHead>{t('managerDashboard.books.table.category')}</TableHead>
                <TableHead>{t('managerDashboard.books.table.copies')}</TableHead>
                <TableHead>{t('managerDashboard.books.table.status')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((book) => (
                <TableRow key={book.id}>
                  <TableCell>
                    <p className="font-medium text-foreground">{book.title}</p>
                    <p className="text-xs text-muted-foreground">{book.author}</p>
                  </TableCell>
                  <TableCell>{book.category}</TableCell>
                  <TableCell>
                    {t('managerDashboard.books.copiesAvailable', {
                      available: book.available_copies,
                      total: book.total_copies,
                    })}
                  </TableCell>
                  <TableCell>
                    <StatusCell book={book} />
                  </TableCell>
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
