import { Prisma, type Book } from '@prisma/client';

import { HttpError } from '@/server/http';
import * as repository from '@/server/books/repository';
import {
  bookToJson,
  type BookCreateInput,
  type BookListResponse,
  type BookOut,
  type BookSort,
  type BookUpdateInput,
} from '@/server/books/schemas';

// Mirrors backend/src/app/modules/books/service.py's non-AI functions. get_book_insights/
// suggest_description/identify_cover and the embedding-ranked half of get_related_books
// are LLM-backed — deferred to phase 7 (AI features); get_related_books here uses only
// the co-borrow and category/author fallback strategies until then.

const RECOMMENDATION_CATEGORY_WEIGHT = 2;
const RECOMMENDATION_AUTHOR_WEIGHT = 3;
const RELATED_BOOKS_LIMIT = 6;

async function ratingsByBook(bookIds: string[]): Promise<Map<string, [number, number]>> {
  const reviews = await repository.listRatingsForBooks(bookIds);
  const byBook = new Map<string, number[]>();
  for (const review of reviews) {
    const list = byBook.get(review.bookId) ?? [];
    list.push(review.rating);
    byBook.set(review.bookId, list);
  }
  const result = new Map<string, [number, number]>();
  for (const [bookId, ratings] of byBook) {
    const average = Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10;
    result.set(bookId, [average, ratings.length]);
  }
  return result;
}

function toBookOut(book: Book, ratings: Map<string, [number, number]>): BookOut {
  const [averageRating, reviewCount] = ratings.get(book.id) ?? [null, 0];
  return bookToJson(book, { averageRating, reviewCount });
}

async function recommend(
  memberId: string,
  candidates: Book[],
): Promise<[Book[], Map<string, number>]> {
  const loans = await repository.listLoansForMember(memberId);
  const borrowedIds = new Set(loans.map((loan) => loan.bookId));
  const categories = new Map<string, number>();
  const authors = new Map<string, number>();
  for (const loan of loans) {
    categories.set(loan.book.category, (categories.get(loan.book.category) ?? 0) + 1);
    authors.set(loan.book.author, (authors.get(loan.book.author) ?? 0) + 1);
  }

  const unread = candidates.filter((book) => !borrowedIds.has(book.id));
  const scores = new Map<string, number>();
  for (const book of unread) {
    scores.set(
      book.id,
      (categories.get(book.category) ?? 0) * RECOMMENDATION_CATEGORY_WEIGHT +
        (authors.get(book.author) ?? 0) * RECOMMENDATION_AUTHOR_WEIGHT,
    );
  }
  return [unread, scores];
}

export async function listBooks(opts: {
  search: string | null;
  category: string | null;
  page: number;
  pageSize: number;
  sort: BookSort;
  memberId: string | null;
}): Promise<BookListResponse> {
  const { search, category, page, pageSize, sort, memberId } = opts;

  if (sort === 'newest') {
    const [items, total] = await repository.listBooks({ search, category, page, pageSize });
    const ratings = await ratingsByBook(items.map((item) => item.id));
    return {
      items: items.map((item) => toBookOut(item, ratings)),
      total,
      page,
      page_size: pageSize,
    };
  }

  if (sort === 'rating') {
    const [items, total] = await repository.listBooksByRating({
      search,
      category,
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    const ratings = await ratingsByBook(items.map((item) => item.id));
    return {
      items: items.map((item) => toBookOut(item, ratings)),
      total,
      page,
      page_size: pageSize,
    };
  }

  // "recommended" scores every candidate against this member's borrowing history, so it
  // genuinely needs the whole matching set before it can pick a page.
  let allBooks = await repository.findAllMatching(search, category);
  const ratings = await ratingsByBook(allBooks.map((book) => book.id));

  let scores = new Map<string, number>();
  if (memberId) {
    [allBooks, scores] = await recommend(memberId, allBooks);
  }
  allBooks = [...allBooks].sort((a, b) => {
    const scoreDiff = (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0);
    if (scoreDiff !== 0) return scoreDiff;
    return (ratings.get(b.id)?.[0] ?? 0) - (ratings.get(a.id)?.[0] ?? 0);
  });

  const total = allBooks.length;
  const start = (page - 1) * pageSize;
  const pageItems = allBooks.slice(start, start + pageSize);
  return {
    items: pageItems.map((book) => toBookOut(book, ratings)),
    total,
    page,
    page_size: pageSize,
  };
}

export async function getBook(bookId: string): Promise<BookOut> {
  const book = await repository.findById(bookId);
  if (!book) throw new HttpError(404, 'Book not found');
  const ratings = await ratingsByBook([bookId]);
  return toBookOut(book, ratings);
}

export async function getRelatedBooks(bookId: string): Promise<BookOut[]> {
  const book = await repository.findById(bookId);
  if (!book) throw new HttpError(404, 'Book not found');

  // Embedding-similarity ranking is phase 7 (LLM-backed) — this goes straight to the
  // same fallback signals the Python version uses to fill out slots embeddings can't.
  let related: Book[] = [];

  if (related.length < RELATED_BOOKS_LIMIT) {
    const excludeIds = [bookId, ...related.map((b) => b.id)];
    const fallback = (await repository.findCoBorrowed(bookId, RELATED_BOOKS_LIMIT)).filter(
      (b) => !excludeIds.includes(b.id),
    );
    related = related.concat(fallback);
  }

  if (related.length < RELATED_BOOKS_LIMIT) {
    const excludeIds = [bookId, ...related.map((b) => b.id)];
    related = related.concat(
      await repository.findByCategoryOrAuthor({
        category: book.category,
        author: book.author,
        excludeIds,
        limit: RELATED_BOOKS_LIMIT - related.length,
      }),
    );
  }

  const ratings = await ratingsByBook(related.map((b) => b.id));
  return related.map((b) => toBookOut(b, ratings));
}

export async function createBook(payload: BookCreateInput): Promise<BookOut> {
  let book: Book;
  try {
    book = await repository.createBook({
      title: payload.title,
      author: payload.author,
      category: payload.category,
      genre: payload.genre ?? null,
      isbn: payload.isbn ?? null,
      description: payload.description ?? null,
      publisher: payload.publisher ?? null,
      publishedYear: payload.published_year ?? null,
      language: payload.language ?? null,
      coverImageUrl: payload.cover_image_url ?? null,
      totalCopies: payload.total_copies,
      shelfLocation: payload.shelf_location ?? null,
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new HttpError(409, 'A book with this ISBN already exists');
    }
    throw err;
  }
  return bookToJson(book);
}

export async function updateBook(bookId: string, payload: BookUpdateInput): Promise<BookOut> {
  const existing = await repository.findById(bookId);
  if (!existing) throw new HttpError(404, 'Book not found');

  const data: Prisma.BookUpdateInput = {};
  if (payload.title !== undefined && payload.title !== null) data.title = payload.title;
  if (payload.author !== undefined && payload.author !== null) data.author = payload.author;
  if (payload.category !== undefined && payload.category !== null) data.category = payload.category;
  if ('genre' in payload) data.genre = payload.genre;
  if ('isbn' in payload) data.isbn = payload.isbn;
  if ('description' in payload) data.description = payload.description;
  if ('publisher' in payload) data.publisher = payload.publisher;
  if ('published_year' in payload) data.publishedYear = payload.published_year;
  if ('language' in payload) data.language = payload.language;
  if ('cover_image_url' in payload) data.coverImageUrl = payload.cover_image_url;
  if (payload.total_copies !== undefined && payload.total_copies !== null) {
    data.totalCopies = payload.total_copies;
  }
  if ('shelf_location' in payload) data.shelfLocation = payload.shelf_location;

  if (Object.keys(data).length === 0) return bookToJson(existing);

  // Any edit to the fields the cached embedding was built from invalidates it — cleared
  // here rather than recomputed inline so an edit never blocks on an LLM call; the next
  // GET /books/{id}/related lazily recomputes it (phase 7).
  if (['title', 'author', 'category', 'description'].some((key) => key in data)) {
    data.embedding = [];
    data.aiInsights = Prisma.JsonNull;
  }

  let updated: Book | null;
  let error: 'not_found' | 'active_loans' | null;
  try {
    [updated, error] = await repository.updateBookWithInventoryGuard(bookId, data);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new HttpError(409, 'A book with this ISBN already exists');
    }
    throw err;
  }
  if (error === 'not_found' || !updated) throw new HttpError(404, 'Book not found');
  if (error === 'active_loans') {
    throw new HttpError(409, 'Total copies cannot be lower than the number of active loans');
  }

  return bookToJson(updated);
}

export async function deleteBook(bookId: string): Promise<void> {
  const existing = await repository.findById(bookId);
  if (!existing) throw new HttpError(404, 'Book not found');
  await repository.softDeleteBook(bookId);
}
