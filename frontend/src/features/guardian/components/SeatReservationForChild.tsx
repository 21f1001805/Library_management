import { Bell, BellRing } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { SeatCard } from '@/components/common';
import { Button, Card, CardContent, CardHeader, CardTitle, Select } from '@/components/ui';
import { SeatLegend } from '@/features/seat-booking/components/SeatLegend';
import { getErrorMessage } from '@/lib/api';
import { useAuth, type GuardianChild, type SeatSlot } from '@/providers/AuthProvider';

const SEAT_ROWS = ['A', 'B', 'C', 'D'];
const SEATS_PER_ROW = 8;
const SEAT_LABELS = SEAT_ROWS.flatMap((row) =>
  Array.from({ length: SEATS_PER_ROW }, (_, index) => `${row}${index + 1}`),
);

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function SeatReservationForChild({ children }: { children: GuardianChild[] }) {
  const { t } = useTranslation();
  const { getSeatSchedule, bookSeatForChild, requestSeatNotifyForChild } = useAuth();
  const [selectedChildId, setSelectedChildId] = useState<string>(children[0]?.id ?? '');
  const [selectedSeatLabel, setSelectedSeatLabel] = useState<string | null>(null);
  const [notifiedSeatLabels, setNotifiedSeatLabels] = useState<Set<string>>(new Set());
  const [seats, setSeats] = useState<SeatSlot[] | null>(null);

  const selectedChild = children.find((child) => child.id === selectedChildId);
  const selectedSeat = seats?.find((seat) => seat.seat_label === selectedSeatLabel) ?? null;
  const isAvailable = selectedSeat?.status === 'available';
  const isNotified = selectedSeat ? notifiedSeatLabels.has(selectedSeat.seat_label) : false;

  // No date/hour picker here (unlike the member seat-booking page) — this widget only
  // ever shows and books the current slot.
  const now = new Date();

  function refreshSchedule() {
    getSeatSchedule(toDateInputValue(now), now.getHours())
      .then((schedule) => setSeats(schedule.seats))
      .catch(() => setSeats(null));
  }

  // Refetches periodically, not just on mount — a mount-only fetch pins the schedule to
  // whichever hour the card happened to open in, so bookings made elsewhere (and the
  // wall clock crossing into the next hour) never appeared on an already-open card.
  useEffect(() => {
    let cancelled = false;

    function fetchSchedule() {
      const current = new Date();
      getSeatSchedule(toDateInputValue(current), current.getHours())
        .then((schedule) => {
          if (!cancelled) setSeats(schedule.seats);
        })
        .catch(() => {
          if (!cancelled) setSeats(null);
        });
    }

    fetchSchedule();
    const interval = setInterval(fetchSchedule, 60_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [getSeatSchedule]);

  function toggleSeat(seatLabel: string) {
    setSelectedSeatLabel((prev) => (prev === seatLabel ? null : seatLabel));
  }

  async function confirmBooking() {
    if (!selectedSeat || !selectedChild || !isAvailable) return;
    try {
      await bookSeatForChild(selectedChild.id, {
        seat_label: selectedSeat.seat_label,
        date: toDateInputValue(now),
        hour: now.getHours(),
      });
      toast.success(
        t('guardian.seatReservation.confirmToast', {
          seatId: selectedSeat.seat_label,
          name: selectedChild.full_name,
        }),
      );
      setSelectedSeatLabel(null);
      refreshSchedule();
    } catch (err) {
      toast.error(getErrorMessage(err, t('common.errors.generic')));
    }
  }

  async function requestNotify() {
    if (!selectedSeat || !selectedChild) return;
    try {
      await requestSeatNotifyForChild(selectedChild.id, {
        seat_label: selectedSeat.seat_label,
        date: toDateInputValue(now),
        hour: now.getHours(),
      });
      setNotifiedSeatLabels((prev) => new Set(prev).add(selectedSeat.seat_label));
      toast.success(
        t('guardian.seatReservation.notifyToast', {
          seatId: selectedSeat.seat_label,
          name: selectedChild.full_name,
        }),
      );
    } catch (err) {
      toast.error(getErrorMessage(err, t('common.errors.generic')));
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('guardian.seatReservation.title')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Select
          label={t('guardian.seatReservation.selectChild')}
          value={selectedChildId}
          onChange={(event) => {
            setSelectedChildId(event.target.value);
            setSelectedSeatLabel(null);
          }}
          options={children.map((child) => ({ value: child.id, label: child.full_name }))}
          placeholder={t('guardian.seatReservation.selectChildPlaceholder')}
        />

        <SeatLegend />

        <div className="flex flex-col gap-3">
          {SEAT_ROWS.map((row) => (
            <div key={row} className="flex items-center gap-3">
              <span className="w-6 text-sm font-semibold text-muted-foreground">{row}</span>
              <div className="grid flex-1 grid-cols-4 gap-2 sm:grid-cols-8">
                {SEAT_LABELS.filter((label) => label.startsWith(row)).map((label) => {
                  const seat = seats?.find((s) => s.seat_label === label);
                  const visualStatus = !seat || seat.status === 'available' ? 'available' : 'reserved';
                  return (
                    <SeatCard
                      key={label}
                      label={label}
                      status={visualStatus}
                      avatarUrl={seat?.booked_by_avatar_url}
                      selected={selectedSeatLabel === label}
                      onSelect={() => toggleSeat(label)}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {!selectedSeat && (
          <p className="text-sm text-muted-foreground">{t('guardian.seatReservation.selectPrompt')}</p>
        )}

        {selectedSeat && isAvailable && selectedChild && (
          <p className="text-sm text-foreground">
            {t('guardian.seatReservation.selected', {
              seatId: selectedSeat.seat_label,
              name: selectedChild.full_name,
            })}
          </p>
        )}

        {selectedSeat && !isAvailable && (
          <div className="rounded-md bg-warning/10 p-3 text-sm font-medium text-warning">
            {t('seatBooking.bookingSummary.reservedByOther', { seatId: selectedSeat.seat_label })}
          </div>
        )}

        {selectedSeat &&
          !isAvailable &&
          (isNotified ? (
            <p className="flex items-center gap-1.5 text-sm text-success">
              <BellRing className="size-4" />
              {t('guardian.seatReservation.notifySet')}
            </p>
          ) : (
            <Button variant="outline" leadingIcon={<Bell className="size-4" />} onClick={requestNotify}>
              {t('guardian.seatReservation.notifyButton')}
            </Button>
          ))}

        <Button disabled={!selectedSeatLabel || !selectedChild || !isAvailable} onClick={confirmBooking}>
          {t('guardian.seatReservation.confirmButton')}
        </Button>
      </CardContent>
    </Card>
  );
}
