import { SlidersHorizontal } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

import { useClickOutside } from '@/hooks';
import { cn } from '@/lib/cn';

export interface FiltersMenuOption {
  value: string;
  label: string;
}

export interface FiltersMenuFilter {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: FiltersMenuOption[];
}

export interface FiltersMenuProps {
  filters: FiltersMenuFilter[];
  triggerLabel?: string;
  className?: string;
}

export function FiltersMenu({ filters, triggerLabel = 'Filters', className }: FiltersMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  useClickOutside(rootRef, () => setOpen(false));

  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLButtonElement>('button')?.focus();

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setOpen(false);
      requestAnimationFrame(() => triggerRef.current?.focus());
    }

    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  // A filter counts as "active" once it's moved off its first (default) option.
  const activeCount = filters.filter(
    (filter) => filter.options.length > 0 && filter.value !== filter.options[0].value,
  ).length;

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        className={cn(
          'relative flex h-10 items-center gap-1.5 rounded-md border border-border bg-surface px-3',
          'text-sm font-medium text-foreground hover:bg-secondary',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        )}
      >
        <SlidersHorizontal className="size-4" aria-hidden="true" />
        {triggerLabel}
        {activeCount > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-primary-gradient ring-2 ring-surface"
            aria-hidden="true"
          />
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-label={triggerLabel}
          className="absolute right-0 z-20 mt-1.5 w-64 rounded-lg border border-border bg-surface p-3 shadow-panel"
        >
          <div className="flex flex-col gap-4">
            {filters.map((filter) => (
              <div key={filter.label} className="flex flex-col gap-1">
                <p className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {filter.label}
                </p>
                <div className="flex flex-col gap-0.5">
                  {filter.options.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => filter.onChange(option.value)}
                      className={cn(
                        'rounded-md px-2.5 py-1.5 text-left text-sm',
                        option.value === filter.value
                          ? 'bg-secondary font-semibold text-foreground'
                          : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
