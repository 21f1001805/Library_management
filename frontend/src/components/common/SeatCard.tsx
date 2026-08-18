import { Armchair, CheckCircle2, Clock, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/cn';

export type SeatStatus = 'available' | 'reserved' | 'occupied' | 'mine';

export interface SeatCardProps {
  label: string;
  status: SeatStatus;
  className?: string;
  selected?: boolean;
  onSelect?: () => void;
  /** Only meaningful for status === 'reserved' or 'mine' — shown instead of the status icon. */
  avatarUrl?: string | null;
}

const statusClasses: Record<SeatStatus, string> = {
  available: 'border-success/30 bg-success/10 text-success',
  reserved: 'border-warning/30 bg-warning/10 text-warning',
  occupied: 'border-danger/30 bg-danger/10 text-danger',
  // Deliberately its own color (not the amber used for "reserved by someone else") —
  // two members can end up with visually similar avatars, so the seat itself needs to
  // read as "yours" at a glance without the person having to inspect the avatar.
  mine: 'border-primary/50 bg-primary/10 text-primary',
};

// Distinct icon shapes per status — color alone (statusClasses above) isn't a reliable
// status cue for colorblind users, so each status also gets its own icon.
const statusIcons: Record<SeatStatus, typeof Armchair> = {
  available: Armchair,
  reserved: Clock,
  occupied: X,
  mine: CheckCircle2,
};

export function SeatCard({ label, status, className, selected, onSelect, avatarUrl }: SeatCardProps) {
  const { t } = useTranslation();
  const statusText = t(`landing.seatAvailability.${status}`);
  const StatusIcon = statusIcons[status];

  const isMine = status === 'mine';
  const hasAvatar = (status === 'reserved' || isMine) && Boolean(avatarUrl);

  const classes = cn(
    'flex flex-col items-center gap-1 rounded-md border p-2 text-xs font-medium',
    statusClasses[status],
    // A thicker, always-on ring on top of the primary-colored background/border above —
    // reserved-by-others seats never get this, so it stays a reliable "this one is yours"
    // signal even before the seat is selected.
    isMine && 'ring-2 ring-primary/70',
    selected && 'ring-2 ring-primary ring-offset-1',
    className,
  );

  // Reserved/mine seats identify who holds them via avatar instead of the generic clock
  // icon + seat label — the seat number is still announced via aria-label/title below,
  // it's just not shown visually since the avatar alone is enough to read as "taken".
  // For your own seat, the avatar also gets a small checkmark badge in the corner so it
  // doesn't rely on you recognizing your own avatar among a grid of similar-looking ones.
  const marker = hasAvatar ? (
    <span className="relative inline-flex">
      <img src={avatarUrl ?? ''} alt="" aria-hidden="true" className="size-10 rounded-full object-cover" />
      {isMine && (
        <CheckCircle2
          aria-hidden="true"
          className="absolute -bottom-1 -right-1 size-4 rounded-full bg-surface text-primary"
        />
      )}
    </span>
  ) : (
    <StatusIcon className="size-6" />
  );

  if (!onSelect) {
    return (
      <div
        title={t('common.cards.seat.labelWithStatus', { label, status: statusText })}
        className={classes}
      >
        {marker}
        {!hasAvatar && label}
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
      {marker}
      {!hasAvatar && label}
    </button>
  );
}
