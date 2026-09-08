import { NextResponse } from 'next/server';

import { withErrorHandling, readJsonBody } from '@/server/http';
import { requireRole } from '@/server/auth/guards';
import { Role } from '@/server/constants';
import { bookUpdateSchema } from '@/server/books/schemas';
import * as booksService from '@/server/books/service';

export const GET = withErrorHandling(async (_request, { params }) => {
  const { bookId } = await params;
  const book = await booksService.getBook(bookId as string);
  return NextResponse.json(book);
});

export const PUT = withErrorHandling(async (request, { params }) => {
  await requireRole(request, Role.ADMIN, Role.LIBRARIAN, Role.MANAGER);
  const { bookId } = await params;
  const payload = bookUpdateSchema.parse(await readJsonBody(request));
  const book = await booksService.updateBook(bookId as string, payload);
  return NextResponse.json(book);
});

export const DELETE = withErrorHandling(async (request, { params }) => {
  await requireRole(request, Role.ADMIN);
  const { bookId } = await params;
  await booksService.deleteBook(bookId as string);
  return new NextResponse(null, { status: 204 });
});
