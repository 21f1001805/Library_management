import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Pagination, TableToolbar } from '@/components/common';
import { NoResults } from '@/components/feedback';
import { Badge, type BadgeVariant, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { usePagination } from '@/hooks';
import { formatDate } from '@/lib/format';
import type { BookRecordEntry, BookRecordType } from '@/providers/AuthProvider';

const typeBadgeVariant: Record<BookRecordType, BadgeVariant> = {
  lost: 'danger',
  donated: 'success',
  purchased: 'default',
};

const typeLabelKey: Record<BookRecordType, string> = {
  lost: 'itHead.bookRecords.types.lost',
  donated: 'itHead.bookRecords.types.donated',
  purchased: 'itHead.bookRecords.types.purchased',
};

export function BookRecords({ records }: { records: BookRecordEntry[] }) {
  const { t } = useTranslation();
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortValue, setSortValue] = useState('newest');

  const filteredRecords = useMemo(() => {
    const items = [...records].filter((record) => {
      if (typeFilter === 'all') return true;
      return record.type === typeFilter;
    });

    switch (sortValue) {
      case 'oldest':
        return items.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      case 'title':
        return items.sort((a, b) => a.book_title.localeCompare(b.book_title));
      case 'newest':
      default:
        return items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
  }, [records, sortValue, typeFilter]);

  const { page, setPage, totalPages, paginatedItems, totalItems } = usePagination(filteredRecords, 5);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('itHead.bookRecords.title')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <TableToolbar
          filters={[
            {
              label: 'Type',
              value: typeFilter,
              onChange: (value) => {
                setTypeFilter(value);
                setPage(1);
              },
              options: [
                { value: 'all', label: 'All' },
                { value: 'lost', label: 'Lost' },
                { value: 'donated', label: 'Donated' },
                { value: 'purchased', label: 'Purchased' },
              ],
            },
          ]}
          sort={{
            label: 'Sort',
            value: sortValue,
            onChange: (value) => {
              setSortValue(value);
              setPage(1);
            },
            options: [
              { value: 'newest', label: 'Newest First' },
              { value: 'oldest', label: 'Oldest First' },
              { value: 'title', label: 'Book Title' },
            ],
          }}
          onReset={() => {
            setTypeFilter('all');
            setSortValue('newest');
            setPage(1);
          }}
          resetLabel={t('common.actions.reset')}
        />
        {filteredRecords.length === 0 ? (
          <NoResults title={t('itHead.bookRecords.empty')} />
        ) : (
          <>
            <ul className="flex flex-col gap-3">
              {paginatedItems.map((record) => (
                <li key={record.id} className="rounded-lg border border-border p-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant={typeBadgeVariant[record.type]}>{t(typeLabelKey[record.type])}</Badge>
                    <span className="text-xs text-muted-foreground">{formatDate(record.created_at)}</span>
                  </div>
                  <p className="mt-1 font-medium text-foreground">{record.book_title}</p>
                  {record.note && <p className="text-muted-foreground">{record.note}</p>}
                  <p className="text-xs text-muted-foreground">{record.logged_by_name}</p>
                </li>
              ))}
            </ul>
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={totalItems}
              pageSize={5}
              onPageChange={setPage}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
