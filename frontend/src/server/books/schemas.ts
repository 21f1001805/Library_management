import type { Book } from '@prisma/client';
import { z } from 'zod';

// Mirrors backend/src/app/modules/books/schemas.py.
export const BOOK_SORTS = ['newest', 'rating', 'recommended'] as const;
export type BookSort = (typeof BOOK_SORTS)[number];

const ISBN_CHARS = /[- ]/g;
const ISBN_10 = /^\d{9}[\dX]$/;
const ISBN_13 = /^\d{13}$/;
const EARLIEST_PRINT_YEAR = 1450;
const MAX_PUBLISHED_YEAR = new Date().getFullYear() + 1;

const isbn = z
  .string()
  .max(20)
  .nullable()
  .optional()
  .transform((value, ctx) => {
    if (!value) return value ?? null;
    const normalized = value.replace(ISBN_CHARS, '').toUpperCase();
    if (!ISBN_10.test(normalized) && !ISBN_13.test(normalized)) {
      ctx.addIssue({
        code: 'custom',
        message: 'isbn must be a 10 or 13 digit ISBN (hyphens/spaces allowed)',
      });
      return z.NEVER;
    }
    return normalized;
  });

const publishedYear = z.number().int().min(EARLIEST_PRINT_YEAR).max(MAX_PUBLISHED_YEAR).nullable().optional();

export const bookCreateSchema = z.object({
  title: z.string().min(1).max(255),
  author: z.string().min(1).max(150),
  category: z.string().min(1).max(80),
  genre: z.string().max(80).nullable().optional(),
  isbn,
  description: z.string().nullable().optional(),
  publisher: z.string().max(150).nullable().optional(),
  published_year: publishedYear,
  language: z.string().max(40).nullable().optional(),
  cover_image_url: z.string().max(8_000_000).nullable().optional(),
  total_copies: z.number().int().min(0).default(0),
  shelf_location: z.string().max(120).nullable().optional(),
});
export type BookCreateInput = z.infer<typeof bookCreateSchema>;

export const bookUpdateSchema = z.object({
  title: z.string().min(1).max(255).nullable().optional(),
  author: z.string().min(1).max(150).nullable().optional(),
  category: z.string().min(1).max(80).nullable().optional(),
  genre: z.string().max(80).nullable().optional(),
  isbn,
  description: z.string().nullable().optional(),
  publisher: z.string().max(150).nullable().optional(),
  published_year: publishedYear,
  language: z.string().max(40).nullable().optional(),
  cover_image_url: z.string().max(8_000_000).nullable().optional(),
  total_copies: z.number().int().min(0).nullable().optional(),
  shelf_location: z.string().max(120).nullable().optional(),
});
export type BookUpdateInput = z.infer<typeof bookUpdateSchema>;

export interface BookOut {
  id: string;
  title: string;
  author: string;
  category: string;
  genre: string | null;
  isbn: string | null;
  description: string | null;
  publisher: string | null;
  published_year: number | null;
  language: string | null;
  cover_image_url: string | null;
  total_copies: number;
  shelf_location: string | null;
  available: boolean;
  average_rating: number | null;
  review_count: number;
  created_at: string;
  updated_at: string;
}

export function bookToJson(
  book: Book,
  opts: { averageRating?: number | null; reviewCount?: number } = {},
): BookOut {
  return {
    id: book.id,
    title: book.title,
    author: book.author,
    category: book.category,
    genre: book.genre,
    isbn: book.isbn,
    description: book.description,
    publisher: book.publisher,
    published_year: book.publishedYear,
    language: book.language,
    cover_image_url: book.coverImageUrl,
    total_copies: book.totalCopies,
    shelf_location: book.shelfLocation,
    available: book.totalCopies > 0,
    average_rating: opts.averageRating ?? null,
    review_count: opts.reviewCount ?? 0,
    created_at: book.createdAt.toISOString(),
    updated_at: book.updatedAt.toISOString(),
  };
}

export interface BookListResponse {
  items: BookOut[];
  total: number;
  page: number;
  page_size: number;
}
