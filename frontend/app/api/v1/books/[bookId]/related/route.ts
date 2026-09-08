import { NextResponse } from 'next/server';

import { withErrorHandling } from '@/server/http';
import * as booksService from '@/server/books/service';

export const GET = withErrorHandling(async (_request, { params }) => {
  const { bookId } = await params;
  const related = await booksService.getRelatedBooks(bookId as string);
  return NextResponse.json(related);
});
