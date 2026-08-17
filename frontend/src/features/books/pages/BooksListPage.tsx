import { Heart, SearchX } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { BookCard, PageHeader } from '@/components/common';
import { NoResults } from '@/components/feedback';
import { Badge, Button, Pagination } from '@/components/ui';
import { ROUTES } from '@/constants/routes';
import { getErrorMessage } from '@/lib/api';
import { useAuth } from '@/providers/AuthProvider';

import { BookFilters } from '../components/BookFilters';
import { WishlistDrawer } from '../components/WishlistDrawer';
import { useBooks, useBooksByIds } from '../hooks/useBooks';
import { useWishlist } from '../hooks/useWishlist';

export function BooksListPage() {
  const { t } = useTranslation();
  const { reserveBook } = useAuth();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [page, setPage] = useState(1);
  const [isWishlistOpen, setIsWishlistOpen] = useState(false);
  const { wishlistIds, isWishlisted, toggleWishlist } = useWishlist();
  const { items: pageBooks, totalPages, refresh } = useBooks(search, category, page);
  const wishlistedBooks = useBooksByIds(wishlistIds);

  async function handleReserve(bookId: string, title: string) {
    try {
      await reserveBook(bookId);
      toast.success(t('books.details.reserveSuccessToast', { title }));
      refresh();
    } catch (error) {
      toast.error(getErrorMessage(error, t('common.errors.generic')));
    }
  }

  function updateSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  function updateCategory(value: string) {
    setCategory(value);
    setPage(1);
  }

  function clearFilters() {
    setSearch('');
    setCategory('All');
    setPage(1);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('books.pageTitle')}
        description={t('books.pageDescription')}
        actions={
          <Button
            variant="outline"
            leadingIcon={<Heart className="size-4" />}
            onClick={() => setIsWishlistOpen(true)}
          >
            {t('books.wishlist.button')}
            {wishlistIds.length > 0 && <Badge variant="danger">{wishlistIds.length}</Badge>}
          </Button>
        }
      />

      <BookFilters
        search={search}
        onSearchChange={updateSearch}
        category={category}
        onCategoryChange={updateCategory}
      />

      {pageBooks.length === 0 ? (
        <NoResults
          icon={SearchX}
          title={t('books.empty.title')}
          description={t('books.empty.description')}
          action={
            <Button size="sm" variant="outline" onClick={clearFilters}>
              {t('books.empty.clearFilters')}
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pageBooks.map((book) => (
            <BookCard
              key={book.id}
              title={book.title}
              author={book.author}
              category={book.category}
              available={book.available}
              href={ROUTES.BOOK_DETAILS.replace(':bookId', book.id)}
              onReserve={() => handleReserve(book.id, book.title)}
              isWishlisted={isWishlisted(book.id)}
              onToggleWishlist={() => toggleWishlist(book.id)}
            />
          ))}
        </div>
      )}

      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />

      <WishlistDrawer
        open={isWishlistOpen}
        onClose={() => setIsWishlistOpen(false)}
        books={wishlistedBooks}
        onRemove={toggleWishlist}
      />
    </div>
  );
}
