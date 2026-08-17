import { AnimatePresence, motion } from 'framer-motion';
import { Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { InputHTMLAttributes, Ref } from 'react';

import { cn } from '@/lib/cn';

export interface SearchBarProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  /** Text shown on the collapsed pill before it's expanded (kept short — it's not the input's placeholder). */
  label?: string;
  ref?: Ref<HTMLInputElement>;
}

// Safari (incl. Chrome-on-iOS, which is Safari's WebKit under the hood) renders
// the SVG goo filter poorly — skip the blur-based morph there and just fade.
function isUnsupportedBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent.toLowerCase();
  const isSafari =
    ua.includes('safari') &&
    !ua.includes('chrome') &&
    !ua.includes('chromium') &&
    !ua.includes('android') &&
    !ua.includes('firefox');
  return isSafari || ua.includes('crios');
}

function GooeyFilter() {
  return (
    <svg aria-hidden className="absolute size-0">
      <defs>
        <filter id="search-bar-goo">
          <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
          <feColorMatrix
            in="blur"
            type="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -15"
            result="goo"
          />
          <feComposite in="SourceGraphic" in2="goo" operator="atop" />
        </filter>
      </defs>
    </svg>
  );
}

function mergeRefs<T>(...refs: (Ref<T> | undefined)[]) {
  return (node: T | null) => {
    for (const ref of refs) {
      if (typeof ref === 'function') ref(node);
      else if (ref) (ref as { current: T | null }).current = node;
    }
  };
}

export function SearchBar({
  ref,
  value,
  onChange,
  onClear,
  className,
  placeholder = 'Search…',
  label = 'Search',
  onBlur,
  ...props
}: SearchBarProps) {
  const [manuallyExpanded, setManuallyExpanded] = useState(false);
  const expanded = manuallyExpanded || value.length > 0;
  const inputRef = useRef<HTMLInputElement>(null);
  const isUnsupported = useMemo(() => isUnsupportedBrowser(), []);

  useEffect(() => {
    if (expanded) inputRef.current?.focus();
  }, [expanded]);

  return (
    <div className={cn('relative', className)}>
      <GooeyFilter />
      <motion.div
        layout
        onClick={() => !expanded && setManuallyExpanded(true)}
        style={isUnsupported ? undefined : { filter: 'url(#search-bar-goo)' }}
        whileHover={!expanded ? { scale: 1.03 } : undefined}
        whileTap={!expanded ? { scale: 0.97 } : undefined}
        transition={{ type: 'spring', bounce: 0.15, duration: 0.5 }}
        className={cn(
          'flex h-10 items-center rounded-full border border-border bg-surface',
          expanded ? 'w-full cursor-text px-3' : 'w-32 cursor-pointer justify-center px-3',
        )}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          {expanded ? (
            <motion.div
              key="input"
              initial={{ opacity: 0, filter: isUnsupported ? 'none' : 'blur(4px)' }}
              animate={{ opacity: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="flex w-full items-center gap-2"
            >
              <Search className="size-4 shrink-0 text-muted-foreground" />
              <input
                ref={mergeRefs(inputRef, ref)}
                type="search"
                value={value}
                onChange={(event) => onChange(event.target.value)}
                onBlur={(event) => {
                  onBlur?.(event);
                  if (!value) setManuallyExpanded(false);
                }}
                placeholder={placeholder}
                className={cn(
                  'w-full bg-transparent text-sm text-foreground outline-none',
                  'placeholder:text-muted-foreground',
                  '[&::-webkit-search-cancel-button]:appearance-none',
                )}
                {...props}
              />
              {value && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => (onClear ? onClear() : onChange(''))}
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              )}
            </motion.div>
          ) : (
            <motion.span
              key="label"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="flex items-center gap-2 whitespace-nowrap text-sm font-medium text-foreground"
            >
              <Search className="size-4" />
              {label}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
