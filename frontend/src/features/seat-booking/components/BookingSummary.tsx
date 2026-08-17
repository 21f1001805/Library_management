import { Bell, BellRing } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import type { SeatBookingRecord, SeatSlot } from '@/providers/AuthProvider';

export interface BookingSummaryProps {
  selectedSeat: SeatSlot | null;
  dateLabel: string;
  hourLabel: string;
  isNotified: boolean;
  /** True when you already hold a different seat in this exact date/hour slot. */
  hasOtherBookingThisSlot: boolean;
  isBusy: boolean;
  myBookings: SeatBookingRecord[];
  onConfirm: () => void;
  onCancelBooking: (bookingId: string) => void;
  onRequestNotify: () => void;
}

function formatBookingHour(hour: number): string {
  const period = hour < 12 ? 'AM' : 'PM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour} ${period}`;
}

export function BookingSummary({
  selectedSeat,
  dateLabel,
  hourLabel,
  isNotified,
  hasOtherBookingThisSlot,
  isBusy,
  myBookings,
  onConfirm,
  onCancelBooking,
  onRequestNotify,
}: BookingSummaryProps) {
  const { t } = useTranslation();
  const isAvailable = selectedSeat?.status === 'available';
  const isMine = selectedSeat?.status === 'booked_by_me';
  const isTaken = selectedSeat?.status === 'reserved';

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('seatBooking.bookingSummary.title')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {!selectedSeat && (
          <p className="text-sm text-muted-foreground">
            {t('seatBooking.bookingSummary.selectPrompt')}
          </p>
        )}

        {selectedSeat && (
          <p className="text-sm text-foreground">
            {t('seatBooking.bookingSummary.slotLabel', {
              seatId: selectedSeat.seat_label,
              date: dateLabel,
              hour: hourLabel,
            })}
          </p>
        )}

        {isTaken && selectedSeat && (
          <div className="rounded-md bg-warning/10 p-3 text-sm font-medium text-warning">
            {t('seatBooking.bookingSummary.reservedByOther', { seatId: selectedSeat.seat_label })}
          </div>
        )}

        {isMine && selectedSeat && (
          <div className="rounded-md bg-primary/10 p-3 text-sm font-medium text-primary">
            {t('seatBooking.bookingSummary.bookedByYou', { seatId: selectedSeat.seat_label })}
          </div>
        )}

        {isAvailable && hasOtherBookingThisSlot && (
          <div className="rounded-md bg-warning/10 p-3 text-sm font-medium text-warning">
            {t('seatBooking.bookingSummary.alreadyBookedThisSlot')}
          </div>
        )}

        {isTaken &&
          (isNotified ? (
            <p className="flex items-center gap-1.5 text-sm text-success">
              <BellRing className="size-4" />
              {t('seatBooking.bookingSummary.notifySet')}
            </p>
          ) : (
            <Button
              variant="outline"
              leadingIcon={<Bell className="size-4" />}
              disabled={isBusy}
              onClick={onRequestNotify}
            >
              {t('seatBooking.bookingSummary.notifyButton')}
            </Button>
          ))}

        {isMine ? (
          <Button
            variant="outline"
            disabled={isBusy}
            onClick={() => selectedSeat?.booking_id && onCancelBooking(selectedSeat.booking_id)}
          >
            {t('seatBooking.bookingSummary.cancelButton')}
          </Button>
        ) : (
          <Button
            disabled={!isAvailable || isBusy || hasOtherBookingThisSlot}
            onClick={onConfirm}
          >
            {t('seatBooking.bookingSummary.confirmButton')}
          </Button>
        )}

        {myBookings.length > 0 && (
          <div className="mt-2 flex flex-col gap-2 border-t border-border pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('seatBooking.bookingSummary.yourBookings')}
            </p>
            {myBookings.map((booking) => (
              <div
                key={booking.id}
                className="flex items-center justify-between gap-2 rounded-md bg-secondary/40 px-3 py-2 text-sm"
              >
                <span className="text-foreground">
                  {booking.seat_label} · {booking.date} · {formatBookingHour(booking.hour)}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={isBusy}
                  onClick={() => onCancelBooking(booking.id)}
                >
                  {t('seatBooking.bookingSummary.cancelButton')}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
