import { BookX } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PageHeader, Pagination, TableToolbar } from '@/components/common';
import { NoResults } from '@/components/feedback';
import {
  Badge,
  SearchBar,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui';
import { formatDate } from '@/lib/format';
import { useDebouncedFetch } from '@/lib/useDebouncedFetch';
import { useAuth, type ManagerBookAvailability } from '@/providers/AuthProvider';

const PAGE_SIZE = 20;
const EMPTY_BOOK_LIST = { items: [] as ManagerBookAvailability[], total: 0 };

// ponytail: a flat, hardcoded list — no Category table yet, add one if categories
// need to be manager-editable instead of a fixed set. Mirrors the member-facing
// catalog's category list (see features/books/components/BookFilters.tsx).
const CATEGORIES = [
  'all',
  'Fiction',
  'Non-Fiction',
  'Science',
  'Technology',
  'Biography',
  'Self-Help',
] as const;

// "Unavailable" splits into two operationally different cases: a copy out on a loan
// with a known due date, versus one with no return date on file at all (e.g. zero
// total copies, or tied up some other way loans don't track) — the latter usually
// needs a manager to go look into it, so it's worth being able to filter to just those.
const STATUSES = ['all', 'available', 'unavailable', 'unavailable_no_date'] as const;

const SORTS = ['title_asc', 'title_desc', 'copies_desc', 'copies_asc'] as const;

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
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [status, setStatus] = useState<string>(STATUSES[0]);
  const [sort, setSort] = useState<string>(SORTS[0]);
  const [page, setPage] = useState(1);

  const { data } = useDebouncedFetch(
    () => getManagerBooks({ search, category, status, sort, page, page_size: PAGE_SIZE }),
    [search, category, status, sort, page, getManagerBooks],
    EMPTY_BOOK_LIST,
  );
  const { items, total } = data;

  function updateSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  function updateCategory(value: string) {
    setCategory(value);
    setPage(1);
  }

  function updateStatus(value: string) {
    setStatus(value);
    setPage(1);
  }

  function updateSort(value: string) {
    setSort(value);
    setPage(1);
  }

  function resetFilters() {
    setSearch('');
    setCategory(CATEGORIES[0]);
    setStatus(STATUSES[0]);
    setSort(SORTS[0]);
    setPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('managerDashboard.books.pageTitle')}
        description={t('managerDashboard.books.pageDescription')}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <SearchBar
          value={search}
          onChange={updateSearch}
          placeholder={t('managerDashboard.books.searchPlaceholder')}
          className="max-w-sm"
        />

        <TableToolbar
          filters={[
            {
              label: t('managerDashboard.books.filters.categoryLabel'),
              value: category,
              onChange: updateCategory,
              options: CATEGORIES.map((value) => ({
                value,
                label:
                  value === 'all' ? t('managerDashboard.books.filters.allCategories') : value,
              })),
            },
            {
              label: t('managerDashboard.books.filters.statusLabel'),
              value: status,
              onChange: updateStatus,
              options: STATUSES.map((value) => ({
                value,
                label: t(`managerDashboard.books.filters.statusOptions.${value}`),
              })),
            },
          ]}
          sort={{
            label: t('managerDashboard.books.filters.sortLabel'),
            value: sort,
            onChange: updateSort,
            options: SORTS.map((value) => ({
              value,
              label: t(`managerDashboard.books.filters.sortOptions.${value}`),
            })),
          }}
          onReset={resetFilters}
          resetLabel={t('common.actions.reset')}
        />
      </div>

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