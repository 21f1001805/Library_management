import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { Prisma, type Book } from '@prisma/client';

import { HttpError } from '@/server/http';
import { buildChatLlm, extractJsonObject, logLlmFailure } from '@/server/llm';
import * as embeddings from '@/server/books/embeddings';
import * as insights from '@/server/books/insights';
import * as repository from '@/server/books/repository';
import {
  bookToJson,
  type BookCreateInput,
  type BookInsightsOut,
  type BookListResponse,
  type BookOut,
  type BookSort,
  type BookUpdateInput,
  type IdentifiedBookFields,
  type IdentifyCoverRequestInput,
  type SuggestDescriptionRequestInput,
} from '@/server/books/schemas';

// Mirrors backend/src/app/modules/books/service.py in full.

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

// Ranked by embedding cosine similarity — semantic similarity across title/author/
// category/description, not a same-category or same-author lookup. Falls back to the
// co-borrow + category/author signals only to fill out the list when too few catalog
// books have a usable embedding yet — never invents a result, just degrades to the
// fallback for whatever slots embeddings can't fill.
export async function getRelatedBooks(bookId: string): Promise<BookOut[]> {
  const book = await repository.findById(bookId);
  if (!book) throw new HttpError(404, 'Book not found');

  const targetVector = await embeddings.ensureEmbedding(book);

  let related: Book[] = [];
  if (targetVector.length > 0) {
    const candidates = await repository.listActiveExcluding(bookId);
    related = embeddings.rankBySimilarity(targetVector, candidates, RELATED_BOOKS_LIMIT);
  }

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
  // GET /books/{id}/related lazily recomputes it.
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

// null means "not available right now" (LLM unreachable, bad output) — distinct from
// 404, which is raised for a missing book before this is ever called. The route
// returns 200 with a null body either way; the frontend renders an "AI unavailable"
// state rather than an error.
export async function getBookInsights(bookId: string): Promise<BookInsightsOut | null> {
  const book = await repository.findById(bookId);
  if (!book) throw new HttpError(404, 'Book not found');
  return insights.ensureInsights(book);
}

const DESCRIPTION_SYSTEM_PROMPT = `You write short library-catalog descriptions.

Given a book's title, author, and category, write a 2-3 sentence description a member
would see on the book's page. Rules:
- No spoilers, no invented plot specifics (character names, twists, endings) unless
  you are confident they are accurate for this exact book.
- If you don't recognize this specific title, write a general, honest description
  based on the title, author, and category alone — do not invent a plot.
- Plain prose only: no headings, no bullet points, no quotation marks around the
  whole thing.
- Output only the description text, nothing else.`;

// Drafts a book description for staff to edit or discard — never saved directly.
// Grounded on purpose: the prompt explicitly tells the model to stay generic rather
// than invent plot details for a book it doesn't actually recognize. Staff always see
// this in an editable field before anything is written to the catalog.
export async function suggestDescription(payload: SuggestDescriptionRequestInput): Promise<string> {
  let human = `Title: ${payload.title}\nAuthor: ${payload.author}`;
  if (payload.category) human += `\nCategory: ${payload.category}`;

  let result;
  try {
    const llm = await buildChatLlm();
    result = await llm.invoke([new SystemMessage(DESCRIPTION_SYSTEM_PROMPT), new HumanMessage(human)]);
  } catch (exc) {
    logLlmFailure('suggest_description', exc, { title: payload.title, author: payload.author });
    throw new HttpError(503, 'The description assistant is unavailable right now. Please try again shortly.');
  }

  const description = String(result.content).trim();
  if (!description) {
    throw new HttpError(503, 'The description assistant is unavailable right now. Please try again shortly.');
  }
  return description;
}

const COVER_VISION_PROMPT = `Look at this photo of a book's front cover. Output ONLY a JSON
object with these exact keys: title, author, isbn. Read them directly off the cover —
title and author are almost always printed on the front; isbn is only there if a
barcode/number is visible. Use null for anything not actually visible in the image.
Never guess a title, author, or ISBN you can't actually read there. Output nothing but
the JSON object — no explanation, no markdown formatting.`;

// Mirrors the fixed category set the Add Book form offers — an Open Library subject
// list that matches none of these leaves category unset rather than guessing wrong.
// Order matters: "science fiction" contains "science" as a substring, so "fiction" must
// be checked first or every science-fiction novel would get miscategorized as Science.
// Same reasoning puts "non-fiction" ahead of the plain "fiction" check.
const CATEGORY_KEYWORDS: [string, string][] = [
  ['non-fiction', 'Non-Fiction'],
  ['nonfiction', 'Non-Fiction'],
  ['fiction', 'Fiction'],
  ['self-help', 'Self-Help'],
  ['self help', 'Self-Help'],
  ['biography', 'Biography'],
  ['autobiography', 'Biography'],
  ['technology', 'Technology'],
  ['computer', 'Technology'],
  ['science', 'Science'],
];

const LANGUAGE_CODES: Record<string, string> = {
  eng: 'English',
  hin: 'Hindi',
  pan: 'Punjabi',
  fre: 'French',
  fra: 'French',
  ger: 'German',
  deu: 'German',
  spa: 'Spanish',
  ita: 'Italian',
  jpn: 'Japanese',
  chi: 'Chinese',
  zho: 'Chinese',
  ara: 'Arabic',
  rus: 'Russian',
};

function mapCategory(subjects: string[]): string | null {
  const lowered = subjects.map((s) => s.toLowerCase());
  for (const [keyword, category] of CATEGORY_KEYWORDS) {
    if (lowered.some((subject) => subject.includes(keyword))) return category;
  }
  return null;
}

// Reads whatever's actually printed on the cover — nothing more. Returns {} on any
// failure (unreachable backend, a text-only model, unparseable reply) rather than
// throwing: a photo that doesn't identify is a normal outcome here, not an error —
// manual entry stays available either way.
async function visionIdentify(image: string): Promise<Record<string, unknown>> {
  try {
    const llm = await buildChatLlm();
    const result = await llm.invoke([
      new HumanMessage({
        content: [
          { type: 'text', text: COVER_VISION_PROMPT },
          { type: 'image_url', image_url: { url: image } },
        ],
      }),
    ]);
    return extractJsonObject(String(result.content)) ?? {};
  } catch (exc) {
    logLlmFailure('cover_vision_identify', exc);
    return {};
  }
}

interface OpenLibraryMetadata {
  title?: string | null;
  author?: string | null;
  isbn?: string | null;
  publisher?: string | null;
  published_year?: number | null;
  language?: string | null;
  category?: string | null;
  description?: string | null;
}

// Open Library is the source of truth for anything that gets saved beyond "what's
// visible in the photo" — this is what stands between a vision guess and the catalog.
// Best-effort: any network or parsing failure just yields no match, leaving the vision
// guess (or a blank field for staff to fill by hand) as the only fallback.
async function lookupMetadata(opts: {
  isbn?: string | null;
  title?: string | null;
  author?: string | null;
}): Promise<OpenLibraryMetadata> {
  const query: Record<string, string> = {};
  if (opts.isbn) query.isbn = String(opts.isbn);
  if (opts.title) query.title = String(opts.title);
  if (opts.author) query.author = String(opts.author);
  if (Object.keys(query).length === 0) return {};

  try {
    const params = new URLSearchParams({
      ...query,
      limit: '1',
      fields: 'title,author_name,first_publish_year,isbn,publisher,language,subject,key',
    });
    const response = await fetch(`https://openlibrary.org/search.json?${params}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`Open Library search returned ${response.status}`);
    const body = (await response.json()) as {
      docs?: Record<string, unknown>[];
    };
    const doc = body.docs?.[0];
    if (!doc) return {};

    let description: string | null = null;
    const workKey = doc.key as string | undefined;
    if (workKey) {
      try {
        const workResponse = await fetch(`https://openlibrary.org${workKey}.json`, {
          signal: AbortSignal.timeout(8000),
        });
        if (workResponse.ok) {
          const workBody = (await workResponse.json()) as { description?: unknown };
          const raw = workBody.description;
          description =
            typeof raw === 'string' ? raw : raw && typeof raw === 'object' && 'value' in raw
              ? String((raw as { value: unknown }).value)
              : null;
        }
      } catch {
        // Description is a bonus, not worth failing the whole lookup over.
      }
    }

    const docIsbn = ((doc.isbn as string[] | undefined) ?? [null])[0];
    const authorName = ((doc.author_name as string[] | undefined) ?? [null])[0];
    const publisher = ((doc.publisher as string[] | undefined) ?? [null])[0];
    const language = ((doc.language as string[] | undefined) ?? [null])[0];
    return {
      title: (doc.title as string | undefined) ?? null,
      author: authorName ?? null,
      isbn: docIsbn ? docIsbn.replace(/-/g, '') : null,
      publisher: publisher ?? null,
      published_year: (doc.first_publish_year as number | undefined) ?? null,
      language: LANGUAGE_CODES[language ?? ''] ?? null,
      category: mapCategory((doc.subject as string[] | undefined) ?? []),
      description,
    };
  } catch (exc) {
    console.error(`Open Library lookup failed for isbn=${opts.isbn} title=${opts.title}`, exc);
    return {};
  }
}

// The full "upload a cover, get a pre-filled form" pipeline: a vision model reads
// whatever it can off the photo, then a real book-metadata API verifies/fills in the
// rest. Nothing here is ever written to the catalog directly — the caller only uses
// this to pre-fill AddBookModal's fields, which staff still review and submit through
// the normal createBook path.
export async function identifyCover(payload: IdentifyCoverRequestInput): Promise<IdentifiedBookFields> {
  const guess = await visionIdentify(payload.image);
  const verified = await lookupMetadata({
    isbn: guess.isbn as string | null | undefined,
    title: guess.title as string | null | undefined,
    author: guess.author as string | null | undefined,
  });

  const pick = (key: 'title' | 'author' | 'isbn'): string | null =>
    (verified[key] as string | null | undefined) || (guess[key] as string | null | undefined) || null;

  return {
    title: pick('title'),
    author: pick('author'),
    isbn: pick('isbn'),
    category: verified.category ?? null,
    description: verified.description ?? null,
    publisher: verified.publisher ?? null,
    published_year: verified.published_year ?? null,
    language: verified.language ?? null,
    verified: Object.keys(verified).length > 0,
  };
}
