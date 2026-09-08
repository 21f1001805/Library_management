import { z } from 'zod';

import type { BookRecordWithRelations } from '@/server/bookRecords/repository';

// Mirrors backend/src/app/modules/book_records/schemas.py.
export const bookRecordCreateSchema = z.object({
  book_id: z.string(),
  type: z.enum(['lost', 'donated', 'purchased']),
  note: z.string().max(500).nullable().optional(),
});
export type BookRecordCreateInput = z.infer<typeof bookRecordCreateSchema>;

export interface BookRecordOut {
  id: string;
  book_id: string;
  book_title: string;
  type: string;
  note: string | null;
  logged_by_name: string;
  created_at: string;
}

export function bookRecordToJson(record: BookRecordWithRelations): BookRecordOut {
  return {
    id: record.id,
    book_id: record.bookId,
    book_title: record.book.title,
    type: record.type,
    note: record.note,
    logged_by_name: record.loggedBy.fullName,
    created_at: record.createdAt.toISOString(),
  };
}
