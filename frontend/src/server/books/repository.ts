import { Prisma, type Book } from '@prisma/client';

import { prisma } from '@/server/db';
import { paginate } from '@/server/db/pagination';

// Mirrors backend/src/app/modules/books/repository.py — the non-AI subset (embedding/
// insights caching writes are kept since they're just cache invalidation, not LLM
// calls; the LLM calls themselves are phase 7).

function listWhere(search: string | null, category: string | null): Prisma.BookWhereInput {
  const where: Prisma.BookWhereInput = { deletedAt: null };
  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { author: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (category && category.toLowerCase() !== 'all') {
    where.category = category;
  }
  return where;
}

export async function findById(bookId: string): Promise<Book | null> {
  const book = await prisma.book.findUnique({ where: { id: bookId } });
  if (!book || book.deletedAt !== null) return null;
  return book;
}

export async function listByIds(bookIds: string[]): Promise<Book[]> {
  if (bookIds.length === 0) return [];
  return prisma.book.findMany({ where: { id: { in: bookIds }, deletedAt: null } });
}

export async function listRatingsForBooks(bookIds: string[]) {
  if (bookIds.length === 0) return [];
  return prisma.review.findMany({ where: { bookId: { in: bookIds } } });
}

export async function saveEmbedding(bookId: string, vector: number[]): Promise<void> {
  await prisma.book.update({ where: { id: bookId }, data: { embedding: vector } });
}

export async function saveAiInsights(bookId: string, data: Prisma.InputJsonValue): Promise<void> {
  await prisma.book.update({ where: { id: bookId }, data: { aiInsights: data } });
}

export async function saveReviewDigest(
  bookId: string,
  opts: { digest: string; reviewCount: number },
): Promise<void> {
  await prisma.book.update({
    where: { id: bookId },
    data: { reviewDigest: opts.digest, reviewDigestReviewCount: opts.reviewCount },
  });
}

export async function listActiveExcluding(bookId: string): Promise<Book[]> {
  return prisma.book.findMany({ where: { deletedAt: null, id: { not: bookId } } });
}

export async function listBooks(opts: {
  search: string | null;
  category: string | null;
  page: number;
  pageSize: number;
}): Promise<[Book[], number]> {
  return paginate(prisma.book, {
    where: listWhere(opts.search, opts.category),
    orderBy: { createdAt: 'desc' },
    skip: (opts.page - 1) * opts.pageSize,
    take: opts.pageSize,
  });
}

// Sorts by average rating (highest first) entirely in SQL — ranked and paginated before
// only the page's reviews are loaded, instead of the whole catalogue plus every review.
// Unreviewed books sort last (NULLS LAST) rather than as if they scored zero.
export async function listBooksByRating(opts: {
  search: string | null;
  category: string | null;
  skip: number;
  take: number;
}): Promise<[Book[], number]> {
  const like = opts.search ? `%${opts.search}%` : null;
  const wantsCategory = Boolean(opts.category && opts.category.toLowerCase() !== 'all');

  const conditions = [Prisma.sql`b.deleted_at IS NULL`];
  if (like !== null) {
    conditions.push(
      Prisma.sql`(b.title ILIKE ${like} OR b.author ILIKE ${like} OR b.description ILIKE ${like})`,
    );
  }
  if (wantsCategory) {
    conditions.push(Prisma.sql`b.category = ${opts.category}`);
  }
  const whereSql = Prisma.join(conditions, ' AND ');

  const totalRows = await prisma.$queryRaw<{ total: bigint }[]>`
    SELECT COUNT(*)::bigint AS total FROM books b WHERE ${whereSql}`;
  const total = totalRows.length > 0 ? Number(totalRows[0].total) : 0;

  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT b.id::text AS id
    FROM books b
    LEFT JOIN reviews rv ON rv.book_id = b.id
    WHERE ${whereSql}
    GROUP BY b.id
    ORDER BY AVG(rv.rating) DESC NULLS LAST, b.created_at DESC
    LIMIT ${opts.take} OFFSET ${opts.skip}`;

  const ids = rows.map((row) => row.id);
  if (ids.length === 0) return [[], total];
  const books = await prisma.book.findMany({ where: { id: { in: ids } } });
  const order = new Map(ids.map((id, index) => [id, index]));
  books.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  return [books, total];
}

export async function findAllMatching(
  search: string | null,
  category: string | null,
): Promise<Book[]> {
  return prisma.book.findMany({ where: listWhere(search, category) });
}

export async function listLoansForMember(memberId: string) {
  return prisma.loan.findMany({ where: { memberId }, include: { book: true } });
}

export async function findCoBorrowed(bookId: string, limit: number): Promise<Book[]> {
  const borrowerLoans = await prisma.loan.findMany({ where: { bookId } });
  const memberIds = [...new Set(borrowerLoans.map((loan) => loan.memberId))];
  if (memberIds.length === 0) return [];

  const otherLoans = await prisma.loan.findMany({
    where: { memberId: { in: memberIds }, bookId: { not: bookId } },
    include: { book: true },
  });

  const counts = new Map<string, number>();
  const books = new Map<string, Book>();
  for (const loan of otherLoans) {
    if (loan.book.deletedAt !== null) continue;
    counts.set(loan.bookId, (counts.get(loan.bookId) ?? 0) + 1);
    books.set(loan.bookId, loan.book);
  }

  return [...books.values()]
    .sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0))
    .slice(0, limit);
}

export async function findByCategoryOrAuthor(opts: {
  category: string;
  author: string;
  excludeIds: string[];
  limit: number;
}): Promise<Book[]> {
  return prisma.book.findMany({
    where: {
      id: { notIn: opts.excludeIds },
      deletedAt: null,
      OR: [{ category: opts.category }, { author: opts.author }],
    },
    orderBy: { createdAt: 'desc' },
    take: opts.limit,
  });
}

export async function createBook(data: Prisma.BookCreateInput): Promise<Book> {
  return prisma.book.create({ data });
}

export async function updateBook(bookId: string, data: Prisma.BookUpdateInput): Promise<Book> {
  return prisma.book.update({ where: { id: bookId }, data });
}

// Keeps copy-count edits serialized with loan issuance for this book via a Postgres
// advisory lock, same as the Python version's `pg_advisory_xact_lock`.
export async function updateBookWithInventoryGuard(
  bookId: string,
  data: Prisma.BookUpdateInput,
): Promise<[Book | null, 'not_found' | 'active_loans' | null]> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${bookId}))`;
    const book = await tx.book.findUnique({ where: { id: bookId } });
    if (!book || book.deletedAt !== null) return [null, 'not_found'] as const;

    const requestedTotal = (data.totalCopies as number | undefined) ?? null;
    if (requestedTotal !== null) {
      const activeLoans = await tx.loan.count({ where: { bookId, returnedAt: null } });
      if (requestedTotal < activeLoans) return [book, 'active_loans'] as const;
    }
    const updated = await tx.book.update({ where: { id: bookId }, data });
    return [updated, null] as const;
  });
}

export async function softDeleteBook(bookId: string): Promise<Book> {
  return prisma.book.update({ where: { id: bookId }, data: { deletedAt: new Date() } });
}
