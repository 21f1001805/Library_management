import { Armchair } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/cn';

export type SeatStatus = 'available' | 'reserved' | 'occupied';

export interface SeatCardProps {
  label: string;
  status: SeatStatus;
  className?: string;
  selected?: boolean;
  onSelect?: () => void;
}

const statusClasses: Record<SeatStatus, string> = {
  available: 'border-success/30 bg-success/10 text-success',
  reserved: 'border-warning/30 bg-warning/10 text-warning',
  occupied: 'border-danger/30 bg-danger/10 text-danger',
};

export function SeatCard({ label, status, className, selected, onSelect }: SeatCardProps) {
  const { t } = useTranslation();
  const statusText = t(`landing.seatAvailability.${status}`);

  const classes = cn(
    'flex flex-col items-center gap-1 rounded-md border p-2 text-xs font-medium',
    statusClasses[status],
    selected && 'ring-2 ring-primary ring-offset-1',
    className,
  );

  if (!onSelect) {
    return (
      <div
        title={t('common.cards.seat.labelWithStatus', { label, status: statusText })}
        className={classes}
      >
        <Armchair className="size-4" />
        {label}
      </div>
    );
  }

  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={t('common.cards.seat.seatLabelWithStatus', { label, status: statusText })}
      onClick={onSelect}
      className={cn(classes, !selected && 'hover:opacity-80')}
    >
      <Armchair className="size-4" />
      {label}
    </button>
  );
}
