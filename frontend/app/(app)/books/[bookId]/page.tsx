import { BookDetailsPage } from '@/features/books/pages/BookDetailsPage';

export default async function Page({ params }: { params: Promise<{ bookId: string }> }) {
  const { bookId } = await params;
  return <BookDetailsPage bookId={bookId} />;
}
