import { Prisma, type Book, type Review } from '@prisma/client';

import { prisma } from '@/server/db';

// Mirrors backend/src/app/modules/recommendations/repository.py in full.

// publishedYear boundaries for the "era" question. Fixed buckets rather than DB-derived
// quantiles — stable across catalog changes, and matches how a member would actually
// describe "old" vs "new" rather than an arbitrary statistical split.
const ERA_BOUNDS: Record<string, [number | null, number | null]> = {
  pre_1950: [null, 1949],
  '1950_1989': [1950, 1989],
  '1990_2009': [1990, 2009],
  '2010_plus': [2010, null],
};

// Authors with at least `minBooks` active books, most-represented first.
export async function countBooksByAuthor(minBooks: number, limit: number): Promise<[string, number][]> {
  const rows = await prisma.$queryRaw<{ author: string; cnt: number }[]>`
    SELECT author, COUNT(*)::int AS cnt
    FROM books
    WHERE deleted_at IS NULL
    GROUP BY author
    HAVING COUNT(*) >= ${minBooks}
    ORDER BY cnt DESC, author ASC
    LIMIT ${limit}`;
  return rows.map((row) => [row.author, row.cnt]);
}

// Active book count per era bucket. 'unknown' (missing publishedYear) is included so
// callers can see it, but it is never offered as a selectable quiz option.
export async function countBooksByEra(): Promise<Record<string, number>> {
  const rows = await prisma.$queryRaw<{ era: string; cnt: number }[]>`
    SELECT
      CASE
        WHEN published_year IS NULL THEN 'unknown'
        WHEN published_year < 1950 THEN 'pre_1950'
        WHEN published_year < 1990 THEN '1950_1989'
        WHEN published_year < 2010 THEN '1990_2009'
        ELSE '2010_plus'
      END AS era,
      COUNT(*)::int AS cnt
    FROM books
    WHERE deleted_at IS NULL
    GROUP BY era`;
  return Object.fromEntries(rows.map((row) => [row.era, row.cnt]));
}

// (books borrowed at least once, books never borrowed), among active books.
export async function countLoanedBooks(): Promise<[number, number]> {
  const rows = await prisma.$queryRaw<{ borrowed: number; never_borrowed: number }[]>`
    SELECT
      COUNT(*) FILTER (WHERE l.loan_count > 0)::int AS borrowed,
      COUNT(*) FILTER (WHERE l.loan_count IS NULL OR l.loan_count = 0)::int AS never_borrowed
    FROM books b
    LEFT JOIN (
      SELECT book_id, COUNT(*) AS loan_count FROM loans GROUP BY book_id
    ) l ON l.book_id = b.id
    WHERE b.deleted_at IS NULL`;
  const row = rows[0];
  return [row.borrowed, row.never_borrowed];
}

export async function countDescribedBooks(): Promise<number> {
  return prisma.book.count({
    where: { deletedAt: null, AND: [{ description: { not: null } }, { description: { not: '' } }] },
  });
}

function nonEmpty(value: string | string[] | null | undefined): value is string | string[] {
  if (value == null) return false;
  return Array.isArray(value) ? value.length > 0 : true;
}

// With neither `author` nor `era`, this is the whole-catalog fallback stage — mirrors
// books/repository.ts::findAllMatching, the same "everything active" fetch the existing
// "recommended" sort already relies on.
export async function findCandidates(opts: {
  author?: string | string[] | null;
  era?: string | string[] | null;
  excludeIds?: Set<string> | null;
}): Promise<Book[]> {
  const { author, era, excludeIds } = opts;
  const where: Prisma.BookWhereInput = { deletedAt: null };

  if (nonEmpty(author)) {
    if (Array.isArray(author)) {
      where.author = author.length > 1 ? { in: author } : author[0];
    } else {
      where.author = author;
    }
  }

  if (nonEmpty(era)) {
    const eras = typeof era === 'string' ? [era] : era;
    const validEras = eras.filter((e) => e in ERA_BOUNDS);
    if (validEras.length === 1) {
      const [yearMin, yearMax] = ERA_BOUNDS[validEras[0]];
      const yearFilter: Prisma.IntFilter = {};
      if (yearMin !== null) yearFilter.gte = yearMin;
      if (yearMax !== null) yearFilter.lte = yearMax;
      where.publishedYear = yearFilter;
    } else if (validEras.length > 1) {
      where.OR = validEras.map((e) => {
        const [yearMin, yearMax] = ERA_BOUNDS[e];
        const yearFilter: Prisma.IntFilter = {};
        if (yearMin !== null) yearFilter.gte = yearMin;
        if (yearMax !== null) yearFilter.lte = yearMax;
        return { publishedYear: yearFilter };
      });
    }
  }

  if (excludeIds && excludeIds.size > 0) {
    where.id = { notIn: [...excludeIds] };
  }

  return prisma.book.findMany({ where });
}

export async function listReviewsForBooks(bookIds: string[]): Promise<Review[]> {
  if (bookIds.length === 0) return [];
  return prisma.review.findMany({ where: { bookId: { in: bookIds } } });
}

export async function countLoansForBooks(bookIds: string[]): Promise<Map<string, number>> {
  if (bookIds.length === 0) return new Map();
  const rows = await prisma.$queryRaw<{ book_id: string; cnt: number }[]>`
    SELECT book_id, COUNT(*)::int AS cnt
    FROM loans
    WHERE book_id = ANY(${bookIds}::uuid[])
    GROUP BY book_id`;
  return new Map(rows.map((row) => [row.book_id, row.cnt]));
}
