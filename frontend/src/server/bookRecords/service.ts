import { Prisma } from '@prisma/client';

import { HttpError } from '@/server/http';
import * as repository from '@/server/bookRecords/repository';
import { bookRecordToJson, type BookRecordCreateInput, type BookRecordOut } from '@/server/bookRecords/schemas';

// Mirrors backend/src/app/modules/book_records/service.py.
export async function createRecord(
  loggedById: string,
  payload: BookRecordCreateInput,
): Promise<BookRecordOut> {
  let record;
  try {
    record = await repository.create({
      bookId: payload.book_id,
      type: payload.type,
      note: payload.note ?? null,
      loggedById,
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
      throw new HttpError(404, 'Book not found');
    }
    throw err;
  }
  return bookRecordToJson(record);
}

export async function listRecords(): Promise<BookRecordOut[]> {
  const records = await repository.listAll();
  return records.map(bookRecordToJson);
}
