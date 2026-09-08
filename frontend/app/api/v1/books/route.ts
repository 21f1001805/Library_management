import { NextResponse } from 'next/server';
import { z } from 'zod';

import { withErrorHandling, readJsonBody } from '@/server/http';
import { getOptionalUser, requireRole } from '@/server/auth/guards';
import { Role } from '@/server/constants';
import { BOOK_SORTS, bookCreateSchema } from '@/server/books/schemas';
import * as booksService from '@/server/books/service';

const listQuerySchema = z.object({
  search: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  sort: z.enum(BOOK_SORTS).default('newest'),
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20),
});

export const GET = withErrorHandling(async (request) => {
  const user = await getOptionalUser(request);
  const url = new URL(request.url);
  const query = listQuerySchema.parse({
    search: url.searchParams.get('search'),
    category: url.searchParams.get('category'),
    sort: url.searchParams.get('sort') ?? undefined,
    page: url.searchParams.get('page') ?? undefined,
    page_size: url.searchParams.get('page_size') ?? undefined,
  });

  const result = await booksService.listBooks({
    search: query.search ?? null,
    category: query.category ?? null,
    sort: query.sort,
    page: query.page,
    pageSize: query.page_size,
    memberId: user?.id ?? null,
  });
  return NextResponse.json(result);
});

export const POST = withErrorHandling(async (request) => {
  await requireRole(request, Role.ADMIN, Role.LIBRARIAN, Role.MANAGER);
  const payload = bookCreateSchema.parse(await readJsonBody(request));
  const book = await booksService.createBook(payload);
  return NextResponse.json(book, { status: 201 });
});
