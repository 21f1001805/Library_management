import { useEffect, useState } from 'react';

import { apiGet } from '@/lib/api';
import { useDebouncedFetch } from '@/lib/useDebouncedFetch';

export interface Book {
  id: string;
  title: string;
  author: string;
  category: string;
  isbn: string | null;
  description: string | null;
  total_copies: number;
  available: boolean;
}

interface BookListResponse {
  items: Book[];
  total: number;
}

export const PAGE_SIZE = 15;

const EMPTY_BOOK_LIST: BookListResponse = { items: [], total: 0 };

export function useBooks(search: string, category: string, page: number) {
  const { data, refresh } = useDebouncedFetch<BookListResponse>(
    () => {
      const params = new URLSearchParams({ page: String(page), page_size: String(PAGE_SIZE) });
      if (search.trim()) params.set('search', search.trim());
      if (category !== 'All') params.set('category', category);
      return apiGet<BookListResponse>(`/books?${params}`);
    },
    [search, category, page],
    EMPTY_BOOK_LIST,
  );

  return {
    items: data.items,
    total: data.total,
    totalPages: Math.max(1, Math.ceil(data.total / PAGE_SIZE)),
    refresh,
  };
}

/** Resolves full book details for a set of ids (e.g. the wishlist), independent of any list/pagination. */
export function useBooksByIds(ids: string[]) {
  const [books, setBooks] = useState<Book[]>([]);
  const idsKey = ids.join(',');

  useEffect(() => {
    let cancelled = false;
    Promise.all(ids.map((id) => apiGet<Book>(`/books/${id}`).catch(() => null))).then(
      (results) => {
        if (!cancelled) setBooks(results.filter((book): book is Book => book !== null));
      },
    );

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  return books;
}
