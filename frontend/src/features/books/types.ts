export type BookSort = 'newest' | 'rating' | 'recommended';

export interface Book {
  id: string;
  title: string;
  author: string;
  category: string;
  isbn: string | null;
  description: string | null;
  total_copies: number;
  available: boolean;
  average_rating: number | null;
  review_count: number;
}

export interface BookListResponse {
  items: Book[];
  total: number;
}

export interface BookListParams {
  search: string;
  category: string;
  sort: BookSort;
  page: number;
}
