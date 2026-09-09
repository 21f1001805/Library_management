import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { prisma } from '@/server/db';
import { SeededRandom } from '@/server/seed/random';

// Mirrors backend/scripts/seed_books.py. One-off import of
// assets/library_novels_400_updated.csv into the books table. Safe to re-run — upserts
// on ISBN, so existing rows are updated in place rather than duplicated.

const CSV_PATH = path.resolve(
  fileURLToPath(new URL('.', import.meta.url)),
  '../../../../assets/library_novels_400_updated.csv',
);

// The CSV has no copy-count column; assign a plausible spread so some books are checked
// out (0 copies) and most have a handful available, matching real usage.
const COPY_WEIGHTS = [0, 1, 2, 3, 4, 5, 6];
const COPY_CHANCES = [10, 25, 25, 20, 10, 6, 4];

function cleanIsbn(raw: string): string {
  return raw.replace(/[- ]/g, '').toUpperCase();
}

function totalCopies(bookId: string): number {
  const rng = new SeededRandom(`book-copies-${bookId}`);
  return rng.choices(COPY_WEIGHTS, COPY_CHANCES, 1)[0];
}

function isbnCoverUrl(isbn: string): string {
  // Open Library serves covers straight off the ISBN, no lookup needed. `default=false`
  // makes it 404 (instead of a 1x1 placeholder gif) when it has no cover for an ISBN,
  // which BookCard's onError already handles by falling back to a placeholder icon.
  return `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`;
}

// The CSV's ISBNs are synthetic (not real registrations), so looking covers up by ISBN
// almost always misses. Searching Open Library by title+author instead — same API
// books/service.ts's identifyCover flow already uses — finds the real edition's cover_i
// for these well-known novels far more reliably. Capped concurrency to stay polite to
// the (unauthenticated, free) API; falls back to the ISBN URL, which at worst 404s
// client-side.
const LOOKUP_CONCURRENCY = 8;

async function coverBySearch(title: string, author: string): Promise<string | null> {
  try {
    const params = new URLSearchParams({ title, author, limit: '5', fields: 'cover_i' });
    const response = await fetch(`https://openlibrary.org/search.json?${params}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { docs?: { cover_i?: number }[] };
    const coverId = (body.docs ?? []).find((doc) => doc.cover_i)?.cover_i;
    return coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : null;
  } catch {
    return null;
  }
}

interface CsvRow {
  book_id: string;
  title: string;
  author: string;
  isbn: string;
  genre: string;
  summary: string;
  publication_year: string;
  language: string;
}

async function resolveCoverUrls(rows: CsvRow[]): Promise<Map<string, string>> {
  const results = new Map<string, string>();
  let next = 0;
  async function worker(): Promise<void> {
    for (;;) {
      const index = next;
      next += 1;
      if (index >= rows.length) return;
      const row = rows[index];
      const isbn = cleanIsbn(row.isbn);
      const found = await coverBySearch(row.title.trim(), row.author.trim());
      results.set(isbn, found ?? isbnCoverUrl(isbn));
    }
  }
  await Promise.all(Array.from({ length: Math.min(LOOKUP_CONCURRENCY, rows.length) }, worker));
  return results;
}

// Minimal RFC4180 parser (quoted fields with embedded commas/escaped quotes/newlines) —
// the CSV's `summary` column needs this; a naive split(',') would corrupt rows.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  while (i < text.length) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += char;
      i += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (char === ',') {
      row.push(field);
      field = '';
      i += 1;
      continue;
    }
    if (char === '\r') {
      i += 1;
      continue;
    }
    if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i += 1;
      continue;
    }
    field += char;
    i += 1;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function parseCsvRows(text: string): CsvRow[] {
  const rows = parseCsv(text).filter((r) => r.length > 1 || r[0] !== '');
  const [header, ...body] = rows;
  return body.map((cols) => {
    const record: Record<string, string> = {};
    header.forEach((key, i) => {
      record[key] = cols[i] ?? '';
    });
    return record as unknown as CsvRow;
  });
}

function rowToBookData(row: CsvRow, coverImageUrl: string): {
  title: string;
  author: string;
  category: string;
  genre: string | null;
  isbn: string;
  description: string;
  publishedYear: number;
  language: string;
  totalCopies: number;
  coverImageUrl: string;
} {
  return {
    title: row.title.trim(),
    author: row.author.trim(),
    category: 'Fiction',
    genre: row.genre.trim() || null,
    isbn: cleanIsbn(row.isbn),
    description: row.summary.trim(),
    publishedYear: parseInt(row.publication_year, 10),
    language: row.language.trim(),
    totalCopies: totalCopies(row.book_id),
    coverImageUrl,
  };
}

export async function seedBooks(): Promise<string> {
  const csvText = await readFile(CSV_PATH, 'utf-8');
  const rows = parseCsvRows(csvText);

  const coverUrls = await resolveCoverUrls(rows);

  let created = 0;
  let updated = 0;
  for (const row of rows) {
    const isbn = cleanIsbn(row.isbn);
    const data = rowToBookData(row, coverUrls.get(isbn) ?? isbnCoverUrl(isbn));
    const existing = await prisma.book.findUnique({ where: { isbn: data.isbn } });
    await prisma.book.upsert({
      where: { isbn: data.isbn },
      create: data,
      update: data,
    });
    if (existing === null) created += 1;
    else updated += 1;
  }

  const line = `Seeded ${rows.length} books (${created} created, ${updated} updated).`;
  console.log(line);
  return line;
}
