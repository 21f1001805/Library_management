import { apiGet } from '@/lib/api';

import type { Book, BookListParams, BookListResponse } from './types';

export const PAGE_SIZE = 15;

export function fetchBooks(params: BookListParams): Promise<BookListResponse> {
  const query = new URLSearchParams({
    page: String(params.page),
    page_size: String(PAGE_SIZE),
    sort: params.sort,
  });
  if (params.search.trim()) query.set('search', params.search.trim());
  if (params.category !== 'All') query.set('category', params.category);
  return apiGet<BookListResponse>(`/books?${query}`);
}

export function fetchBookById(bookId: string): Promise<Book> {
  return apiGet<Book>(`/books/${bookId}`);
}

export function fetchRelatedBooks(bookId: string): Promise<Book[]> {
  return apiGet<Book[]>(`/books/${bookId}/related`);
}
