import { ReviewsPage } from '@/features/reviews/pages/ReviewsPage';

export default async function Page({ params }: { params: Promise<{ bookId: string }> }) {
  const { bookId } = await params;
  return <ReviewsPage bookId={bookId} />;
}
