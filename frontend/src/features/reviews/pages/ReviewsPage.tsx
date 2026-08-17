import { MessageSquare, MessageSquareOff, Star, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { toast } from 'sonner';

import { PageTitle, ReviewCard, StatisticCard } from '@/components/common';
import { Button, Dialog, EmptyState } from '@/components/ui';
import { ROUTES } from '@/constants/routes';
import { apiGet, getErrorMessage } from '@/lib/api';
import { useAuth, type BookReviews, type Review } from '@/providers/AuthProvider';

import type { Book } from '../../books/hooks/useBooks';
import { RatingSummary } from '../components/RatingSummary';
import { WriteReviewModal, type ReviewDraft } from '../components/WriteReviewModal';

function bookLink(bookId: string) {
  return ROUTES.BOOK_DETAILS.replace(':bookId', bookId);
}

const EMPTY_BOOK_REVIEWS: BookReviews = {
  items: [],
  average_rating: 0,
  total_reviews: 0,
  breakdown: [5, 4, 3, 2, 1].map((stars) => ({ stars, percent: 0 })),
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function ReviewsPage() {
  const { t } = useTranslation();
  const { role, getBookReviews, getAllReviews, createReview, updateReview, deleteReview } =
    useAuth();
  const isStaff = role === 'admin' || role === 'manager' || role === 'it-head';
  const canModerate = role === 'admin' || role === 'it-head';

  // ponytail: this page has always shown one hardcoded "featured" book (no bookId route
  // param exists — /reviews is a plain sidebar destination, not book-specific). Wiring it
  // to a real backend keeps that shape but picks a real book instead of a fake one: the
  // first book in the catalog. Make this page take a real :bookId param if it ever needs
  // to show reviews for more than one book.
  const [featuredBook, setFeaturedBook] = useState<Book | null>(null);
  const [bookReviews, setBookReviews] = useState<BookReviews>(EMPTY_BOOK_REVIEWS);
  const [allReviews, setAllReviews] = useState<Review[]>([]);
  const [isWriteReviewOpen, setIsWriteReviewOpen] = useState(false);
  const [editingReview, setEditingReview] = useState<Review | null>(null);
  const [deletingReviewId, setDeletingReviewId] = useState<string | null>(null);

  const reviews = isStaff ? allReviews : bookReviews.items;
  const deletingReview = reviews.find((review) => review.id === deletingReviewId) ?? null;

  useEffect(() => {
    if (isStaff) {
      getAllReviews().then(setAllReviews).catch(() => setAllReviews([]));
      return;
    }
    apiGet<{ items: Book[] }>('/books?page_size=1')
      .then((data) => data.items[0] ?? null)
      .then((book) => {
        setFeaturedBook(book);
        if (!book) return EMPTY_BOOK_REVIEWS;
        return getBookReviews(book.id);
      })
      .then((data) => data && setBookReviews(data))
      .catch(() => setBookReviews(EMPTY_BOOK_REVIEWS));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStaff]);

  const booksReviewed = useMemo(
    () => new Set(allReviews.map((review) => review.book_title)).size,
    [allReviews],
  );
  const averageRating = useMemo(
    () =>
      allReviews.length === 0
        ? 0
        : allReviews.reduce((sum, review) => sum + review.rating, 0) / allReviews.length,
    [allReviews],
  );

  async function handleSubmitReview(draft: ReviewDraft) {
    try {
      if (editingReview) {
        await updateReview(editingReview.id, draft);
        setEditingReview(null);
        if (featuredBook) getBookReviews(featuredBook.id).then(setBookReviews).catch(() => {});
        return;
      }

      await createReview(draft.bookId, draft);
      setIsWriteReviewOpen(false);

      // Whatever book was just reviewed becomes the page's displayed book, so the write
      // immediately shows up — this page has no :bookId route param of its own (see the
      // note above featuredBook) to instead navigate to.
      const [book, reviewsForBook] = await Promise.all([
        apiGet<Book>(`/books/${draft.bookId}`),
        getBookReviews(draft.bookId),
      ]);
      setFeaturedBook(book);
      setBookReviews(reviewsForBook);
    } catch (err) {
      toast.error(getErrorMessage(err, t('common.errors.generic')));
    }
  }

  function closeReviewModal() {
    setIsWriteReviewOpen(false);
    setEditingReview(null);
  }

  async function confirmDeleteReview() {
    if (!deletingReview) return;
    try {
      await deleteReview(deletingReview.id);
      setDeletingReviewId(null);
      if (isStaff) {
        setAllReviews((prev) => prev.filter((review) => review.id !== deletingReview.id));
      } else if (featuredBook) {
        getBookReviews(featuredBook.id).then(setBookReviews).catch(() => {});
      }
    } catch (err) {
      toast.error(getErrorMessage(err, t('common.errors.generic')));
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageTitle
        title={t('reviews.pageTitle')}
        description={
          isStaff ? (
            t('reviews.admin.pageDescription')
          ) : featuredBook ? (
            <>
              <Link to={bookLink(featuredBook.id)} className="hover:underline">
                {featuredBook.title}
              </Link>{' '}
              <span className="text-foreground">
                {t('reviews.byAuthor', { author: featuredBook.author })}
              </span>
            </>
          ) : undefined
        }
        actions={
          !isStaff && (
            <Button onClick={() => setIsWriteReviewOpen(true)}>{t('reviews.writeReview')}</Button>
          )
        }
      />

      {isStaff ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatisticCard
            icon={MessageSquare}
            label={t('reviews.admin.stats.totalReviews')}
            value={String(allReviews.length)}
          />
          <StatisticCard
            icon={Star}
            label={t('reviews.admin.stats.averageRating')}
            value={averageRating.toFixed(1)}
          />
          <StatisticCard
            icon={Users}
            label={t('reviews.admin.stats.booksReviewed')}
            value={String(booksReviewed)}
          />
        </div>
      ) : (
        <RatingSummary
          averageRating={bookReviews.average_rating}
          totalReviews={bookReviews.total_reviews}
          breakdown={bookReviews.breakdown}
        />
      )}

      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-foreground">{t('reviews.commentsHeading')}</h2>
        {reviews.length === 0 ? (
          <EmptyState
            icon={MessageSquareOff}
            title={t('reviews.empty.title')}
            description={t('reviews.empty.description')}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {reviews.map((review) => (
              <ReviewCard
                key={review.id}
                name={review.reviewer_name}
                avatarUrl={review.reviewer_avatar_url}
                role={
                  isStaff ? (
                    <>
                      {formatDate(review.created_at)} ·{' '}
                      <Link to={bookLink(review.book_id)} className="hover:underline">
                        {review.book_title}
                      </Link>
                    </>
                  ) : (
                    formatDate(review.created_at)
                  )
                }
                quote={review.comment}
                rating={review.rating}
                images={review.images}
                onEdit={review.is_own ? () => setEditingReview(review) : undefined}
                onDelete={canModerate ? () => setDeletingReviewId(review.id) : undefined}
              />
            ))}
          </div>
        )}
      </div>

      <WriteReviewModal
        open={isWriteReviewOpen || editingReview !== null}
        onClose={closeReviewModal}
        onSubmit={handleSubmitReview}
        initialValues={
          editingReview
            ? {
                bookId: editingReview.book_id,
                bookTitle: editingReview.book_title,
                bookAuthor: editingReview.book_author,
                rating: editingReview.rating,
                comment: editingReview.comment,
                images: editingReview.images,
              }
            : undefined
        }
      />

      <Dialog
        open={deletingReview !== null}
        onClose={() => setDeletingReviewId(null)}
        title={t('reviews.deleteDialog.title')}
        description={t('reviews.deleteDialog.description')}
        confirmLabel={t('reviews.deleteDialog.confirmLabel')}
        confirmVariant="danger"
        onConfirm={confirmDeleteReview}
      />
    </div>
  );
}
