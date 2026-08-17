import { ArrowLeft, BookOpen, Heart } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';

import { BookCard } from '@/components/common';
import { Badge, Button, Card, CardContent, EmptyState } from '@/components/ui';
import { ROUTES } from '@/constants/routes';
import { apiGet, getErrorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useAuth } from '@/providers/AuthProvider';

import type { Book } from '../hooks/useBooks';
import { useWishlist } from '../hooks/useWishlist';

export function BookDetailsPage() {
  const { t } = useTranslation();
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  const { reserveBook } = useAuth();
  const [book, setBook] = useState<Book | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | undefined>(undefined);
  const [relatedBooks, setRelatedBooks] = useState<Book[]>([]);
  const { isWishlisted, toggleWishlist } = useWishlist();

  useEffect(() => {
    if (!bookId) return;
    apiGet<Book>(`/books/${bookId}`)
      .then((data) => setBook(data))
      .catch(() => setBook(null))
      .finally(() => setLoadedFor(bookId));
    apiGet<Book[]>(`/books/${bookId}/related`)
      .then(setRelatedBooks)
      .catch(() => setRelatedBooks([]));
  }, [bookId]);

  async function handleReserve() {
    if (!book) return;
    try {
      await reserveBook(book.id);
      // Requesting to borrow doesn't hold a copy — the book stays visible as available
      // to others until a manager approves the request.
      toast.success(t('books.details.reserveSuccessToast', { title: book.title }));
    } catch (error) {
      toast.error(getErrorMessage(error, t('common.errors.generic')));
    }
  }

  if (bookId !== loadedFor) return null;

  if (!book) {
    return (
      <EmptyState
        title={t('books.details.notFound.title')}
        description={t('books.details.notFound.description')}
        action={
          <Button variant="outline" onClick={() => navigate(ROUTES.BOOKS)}>
            {t('books.details.backToBooks')}
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Link
        to={ROUTES.BOOKS}
        className="flex w-fit items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> {t('books.details.backToBooks')}
      </Link>

      <Card>
        <CardContent className="flex flex-col gap-6 p-6 md:flex-row">
          <div className="flex h-48 w-full items-center justify-center rounded-md bg-primary/10 text-primary md:w-48 md:shrink-0">
            <BookOpen className="size-12" />
          </div>

          <div className="flex flex-1 flex-col gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">{book.title}</h1>
              <p className="text-muted-foreground">{book.author}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{book.category}</Badge>
              <Badge variant={book.available ? 'success' : 'danger'}>
                {book.available ? t('books.status.available') : t('books.status.checkedOut')}
              </Badge>
            </div>

            <p className="text-sm text-muted-foreground">{book.description}</p>

            <p className="text-sm text-muted-foreground">
              {t('books.details.copiesAvailable', { total: book.total_copies })}
            </p>

            <div className="flex gap-2">
              <Button disabled={!book.available} onClick={handleReserve}>
                {t('books.details.reserveButton')}
              </Button>
              <Button
                variant="outline"
                leadingIcon={
                  <Heart className={cn('size-4', isWishlisted(book.id) && 'fill-danger text-danger')} />
                }
                onClick={() => toggleWishlist(book.id)}
              >
                {t(isWishlisted(book.id) ? 'books.wishlist.remove' : 'books.wishlist.add')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {relatedBooks.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-foreground">
            {t('books.details.relatedBooks.title')}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {relatedBooks.map((related) => (
              <BookCard
                key={related.id}
                title={related.title}
                author={related.author}
                category={related.category}
                available={related.available}
                href={ROUTES.BOOK_DETAILS.replace(':bookId', related.id)}
                isWishlisted={isWishlisted(related.id)}
                onToggleWishlist={() => toggleWishlist(related.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
