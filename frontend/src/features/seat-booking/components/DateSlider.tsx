import { motion } from 'framer-motion';

import { cn } from '@/lib/cn';

export interface DateSliderOption {
  value: string;
  label: string;
  subLabel: string;
}

export interface DateSliderProps {
  options: DateSliderOption[];
  active: string;
  ariaLabel: string;
  onChange: (value: string) => void;
}

// Same sliding-pill pattern as the pricing page's DurationToggle: picking a date is a
// single tap on the tab itself (no intermediate modal), so the seat matrix underneath
// updates immediately for that day at whatever hour is currently selected — the time
// picker is a separate, secondary control.
export function DateSlider({ options, active, ariaLabel, onChange }: DateSliderProps) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="grid grid-cols-3 gap-1 rounded-lg border border-border bg-secondary/60 p-1"
    >
      {options.map((option) => {
        const isActive = option.value === active;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(option.value)}
            className={cn(
              'relative flex flex-col items-center gap-0.5 rounded-md px-3.5 py-2.5 text-sm font-medium transition-colors',
              isActive ? 'text-primary-foreground' : 'text-foreground hover:text-foreground/80',
            )}
          >
            {isActive && (
              <motion.span
                layoutId="seat-booking-date-pill"
                className="absolute inset-0 rounded-md bg-primary-gradient"
                transition={{ type: 'spring', stiffness: 400, damping: 32 }}
              />
            )}
            <span className="relative">{option.label}</span>
            <span
              className={cn(
                'relative text-xs font-normal',
                isActive ? 'text-primary-foreground' : 'text-muted-foreground',
              )}
            >
              {option.subLabel}
            </span>
          </button>
        );
      })}
    </div>
  );
}
