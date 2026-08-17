import { BookOpen, Heart, Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Badge, Button } from '@/components/ui';
import { cn } from '@/lib/cn';

export interface BookCardProps {
  title: string;
  author: string;
  category: string;
  available: boolean;
  /** Omitted until book reviews are wired to a real backend. */
  rating?: number;
  href: string;
  onReserve?: () => void;
  isWishlisted?: boolean;
  onToggleWishlist?: () => void;
  className?: string;
}

export function BookCard({
  title,
  author,
  category,
  available,
  rating,
  href,
  onReserve,
  isWishlisted,
  onToggleWishlist,
  className,
}: BookCardProps) {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        'relative flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 transition-colors hover:border-primary/40',
        className,
      )}
    >
      {onToggleWishlist && (
        <button
          type="button"
          onClick={onToggleWishlist}
          aria-pressed={isWishlisted}
          aria-label={t(
            isWishlisted ? 'books.wishlist.removeAria' : 'books.wishlist.addAria',
            { title },
          )}
          className={cn(
            'absolute right-3 top-3 z-10 rounded-full bg-surface/80 p-1.5 transition-colors hover:bg-secondary',
            isWishlisted ? 'text-danger' : 'text-muted-foreground',
          )}
        >
          <Heart className={cn('size-4', isWishlisted && 'fill-danger')} />
        </button>
      )}

      <Link
        to={href}
        className="flex flex-col gap-3"
        aria-label={t('common.cards.book.viewDetailsAria', { title })}
      >
        <div className="flex h-32 items-center justify-center rounded-md bg-primary/10 text-primary">
          <BookOpen className="size-8" />
        </div>
        <div>
          <p className="line-clamp-2 font-semibold text-foreground">{title}</p>
          <p className="text-sm text-muted-foreground">{author}</p>
        </div>
      </Link>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{category}</Badge>
        <Badge variant={available ? 'success' : 'danger'}>
          {available ? t('books.status.available') : t('books.status.checkedOut')}
        </Badge>
      </div>

      <div className="flex items-center justify-between">
        {rating !== undefined ? (
          <span className="flex items-center gap-1 text-sm text-muted-foreground">
            <Star className="size-4 fill-warning text-warning" />
            {rating.toFixed(1)}
          </span>
        ) : (
          <span />
        )}
        <Button
          size="sm"
          variant={available ? 'primary' : 'outline'}
          disabled={!available}
          onClick={onReserve}
        >
          {t('common.cards.book.reserve')}
        </Button>
      </div>
    </div>
  );
}
