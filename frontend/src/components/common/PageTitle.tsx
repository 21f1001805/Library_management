import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

export interface PageTitleProps {
  title: ReactNode;
  description?: ReactNode;
  /** Rendered inline next to the heading, e.g. an unread-count badge. */
  titleAdornment?: ReactNode;
  /** Right-aligned action row, e.g. a button. */
  actions?: ReactNode;
  className?: string;
}

// Lighter sibling to PageHeader (no card/blob background) for plain list pages that just
// need a title + description.
export function PageTitle({
  title,
  description,
  titleAdornment,
  actions,
  className,
}: PageTitleProps) {
  const heading = titleAdornment ? (
    <div className="flex items-center gap-3">
      <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
      {titleAdornment}
    </div>
  ) : (
    <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
  );
  const descriptionEl = description && <p className="mt-1 text-muted-foreground">{description}</p>;

  if (!actions) {
    return (
      <div className={className}>
        {heading}
        {descriptionEl}
      </div>
    );
  }

  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-3', className)}>
      <div>
        {heading}
        {descriptionEl}
      </div>
      {actions}
    </div>
  );
}
