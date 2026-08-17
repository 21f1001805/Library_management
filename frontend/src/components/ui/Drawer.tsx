import { useId, type ReactNode } from 'react';
import { X } from 'lucide-react';

import { cn } from '@/lib/cn';

import { Overlay } from './internal/Overlay';

export type DrawerSide = 'left' | 'right';

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  side?: DrawerSide;
  className?: string;
}

export function Drawer({ open, onClose, title, children, side = 'right', className }: DrawerProps) {
  const titleId = useId();

  return (
    <Overlay
      open={open}
      onClose={onClose}
      labelledBy={title ? titleId : undefined}
      panelClassName={cn('h-full', side === 'left' ? 'mr-auto' : 'ml-auto')}
    >
      <div
        className={cn(
          'flex h-full w-[calc(100vw-3rem)] max-w-sm flex-col bg-surface shadow-panel',
          className,
        )}
      >
        {title && (
          <div className="flex items-center justify-between border-b border-border p-4">
            <h2 id={titleId} className="text-lg font-semibold text-foreground">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <X className="size-5" />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </Overlay>
  );
}
