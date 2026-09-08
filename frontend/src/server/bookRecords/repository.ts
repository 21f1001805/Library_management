import type { Prisma } from '@prisma/client';

import { prisma } from '@/server/db';

// Mirrors backend/src/app/modules/book_records/repository.py.
const RECORD_INCLUDE = { book: true, loggedBy: true } satisfies Prisma.BookRecordInclude;
export type BookRecordWithRelations = Prisma.BookRecordGetPayload<{ include: typeof RECORD_INCLUDE }>;

const LIST_LIMIT = 200;

export async function create(opts: {
  bookId: string;
  type: string;
  note: string | null;
  loggedById: string;
}): Promise<BookRecordWithRelations> {
  return prisma.bookRecord.create({
    data: { bookId: opts.bookId, type: opts.type, note: opts.note, loggedById: opts.loggedById },
    include: RECORD_INCLUDE,
  });
}

export async function listAll(): Promise<BookRecordWithRelations[]> {
  return prisma.bookRecord.findMany({
    include: RECORD_INCLUDE,
    orderBy: { createdAt: 'desc' },
    take: LIST_LIMIT,
  });
}
