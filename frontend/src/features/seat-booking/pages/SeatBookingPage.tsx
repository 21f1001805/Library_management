import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { PageTitle, SeatCard } from '@/components/common';
import { getErrorMessage } from '@/lib/api';
import { useAuth, type SeatBookingRecord, type SeatSlot } from '@/providers/AuthProvider';

import { BookingSummary } from '../components/BookingSummary';
import { SeatLegend } from '../components/SeatLegend';

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

function formatHourLabel(hour: number): string {
  const period = hour < 12 ? 'AM' : 'PM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour} ${period}`;
}

function slotKey(seatLabel: string, date: string, hour: number): string {
  return `${seatLabel}|${date}|${hour}`;
}

const dayFormatter = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

export function SeatBookingPage() {
  const { t } = useTranslation();
  const {
    getSeatSchedule,
    bookSeat,
    getMySeatBookings,
    cancelSeatBooking,
    requestSeatNotify,
  } = useAuth();

  const dateOptions = useMemo(() => {
    const today = new Date();
    return [0, 1, 2].map((offset) => {
      const date = new Date(today);
      date.setDate(date.getDate() + offset);
      return {
        value: toDateInputValue(date),
        label: offset === 0 ? t('seatBooking.today') : dayFormatter.format(date),
      };
    });
  }, [t]);

  const todayValue = dateOptions[0].value;
  const [selectedDate, setSelectedDate] = useState(todayValue);
  const [selectedHour, setSelectedHour] = useState(() => new Date().getHours());
  const [seats, setSeats] = useState<SeatSlot[] | null>(null);
  const [selectedSeatLabel, setSelectedSeatLabel] = useState<string | null>(null);
  const [myBookings, setMyBookings] = useState<SeatBookingRecord[]>([]);
  const [notifiedSlots, setNotifiedSlots] = useState<Set<string>>(new Set());
  const [isBusy, setIsBusy] = useState(false);
  const hourStripRef = useRef<HTMLDivElement>(null);

  const isHourPast = (hour: number) => selectedDate === todayValue && hour < new Date().getHours();
  // If the raw selection is a hour that's since slipped into the past for "Today"
  // (e.g. picked while browsing tomorrow, then switched back), fall back to the
  // current hour rather than fetching/booking a slot the backend will reject anyway.
  const effectiveHour = isHourPast(selectedHour) ? new Date().getHours() : selectedHour;

  const selectedSeat = seats?.find((seat) => seat.seat_label === selectedSeatLabel) ?? null;
  // A "booked_by_me" seat already reflects this for the currently selected seat, but a
  // member could have booked a *different* seat in this same slot and then selected an
  // available one — this catches that case so Confirm doesn't round-trip to a 409.
  const hasOtherBookingThisSlot =
    selectedSeat?.status !== 'booked_by_me' &&
    myBookings.some((booking) => booking.date === selectedDate && booking.hour === effectiveHour);

  // The hour strip scrolls both ways — this just opens on the later hours in
  // view (roughly "now" onward) instead of always starting at 12 AM.
  useEffect(() => {
    const el = hourStripRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, []);

  // Selection deliberately persists across date/hour changes — flipping through
  // slots to see when a specific seat frees up is a reasonable thing to want.
  useEffect(() => {
    let cancelled = false;
    getSeatSchedule(selectedDate, effectiveHour)
      .then((schedule) => {
        if (!cancelled) setSeats(schedule.seats);
      })
      .catch(() => {
        if (!cancelled) setSeats(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedDate, effectiveHour, getSeatSchedule]);

  useEffect(() => {
    getMySeatBookings().then(setMyBookings);
  }, [getMySeatBookings]);

  function reportError(error: unknown) {
    toast.error(getErrorMessage(error, t('common.errors.generic')));
  }

  async function refreshSchedule() {
    const schedule = await getSeatSchedule(selectedDate, effectiveHour);
    setSeats(schedule.seats);
  }

  async function confirmBooking() {
    if (
      !selectedSeat ||
      selectedSeat.status !== 'available' ||
      isHourPast(effectiveHour) ||
      hasOtherBookingThisSlot
    )
      return;
    setIsBusy(true);
    try {
      await bookSeat({ seat_label: selectedSeat.seat_label, date: selectedDate, hour: effectiveHour });
      await refreshSchedule();
      setMyBookings(await getMySeatBookings());
      toast.success(t('seatBooking.confirmToast', { seatId: selectedSeat.seat_label }));
    } catch (error) {
      reportError(error);
    } finally {
      setIsBusy(false);
    }
  }

  async function cancelBooking(bookingId: string) {
    setIsBusy(true);
    try {
      await cancelSeatBooking(bookingId);
      await refreshSchedule();
      setMyBookings(await getMySeatBookings());
    } catch (error) {
      reportError(error);
    } finally {
      setIsBusy(false);
    }
  }

  async function requestNotify() {
    if (!selectedSeat) return;
    setIsBusy(true);
    try {
      await requestSeatNotify({
        seat_label: selectedSeat.seat_label,
        date: selectedDate,
        hour: effectiveHour,
      });
      setNotifiedSlots((prev) =>
        new Set(prev).add(slotKey(selectedSeat.seat_label, selectedDate, effectiveHour)),
      );
      toast.success(t('seatBooking.bookingSummary.notifyToast', { seatId: selectedSeat.seat_label }));
    } catch (error) {
      reportError(error);
    } finally {
      setIsBusy(false);
    }
  }

  const isNotified = selectedSeat
    ? notifiedSlots.has(slotKey(selectedSeat.seat_label, selectedDate, effectiveHour))
    : false;

  return (
    <div className="flex flex-col gap-6">
      <PageTitle title={t('seatBooking.pageTitle')} description={t('seatBooking.pageDescription')} />

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
        <div className="flex flex-wrap justify-end gap-2">
          {dateOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setSelectedDate(option.value)}
              className={
                'rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ' +
                (selectedDate === option.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary/60 text-foreground hover:bg-secondary')
              }
            >
              {option.label}
            </button>
          ))}
        </div>
        <div ref={hourStripRef} className="flex gap-2 overflow-x-auto pb-1">
          {HOURS.map((hour) => {
            const disabled = isHourPast(hour);
            return (
              <button
                key={hour}
                type="button"
                disabled={disabled}
                onClick={() => setSelectedHour(hour)}
                className={
                  'shrink-0 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ' +
                  (disabled
                    ? 'cursor-not-allowed bg-secondary/20 text-muted-foreground/50'
                    : effectiveHour === hour
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary/60 text-foreground hover:bg-secondary')
                }
              >
                {formatHourLabel(hour)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-6">
          <SeatLegend />
          <div className="flex flex-col gap-4">
            {SEAT_ROWS.map((row) => (
              <div key={row} className="flex items-center gap-3">
                <span className="w-6 text-sm font-semibold text-muted-foreground">{row}</span>
                <div className="grid flex-1 grid-cols-4 gap-2 sm:grid-cols-8">
                  {SEAT_LABELS.filter((label) => label.startsWith(row)).map((label) => {
                    const seat = seats?.find((s) => s.seat_label === label);
                    // SeatCard only knows available/reserved/occupied; "booked_by_me" is
                    // still "not available" visually — the BookingSummary panel is what
                    // reveals it's actually your own booking once you select it.
                    const visualStatus = !seat || seat.status === 'available' ? 'available' : 'reserved';
                    return (
                      <SeatCard
                        key={label}
                        label={label}
                        status={visualStatus}
                        selected={selectedSeatLabel === label}
                        onSelect={() => setSelectedSeatLabel(label)}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <BookingSummary
          selectedSeat={selectedSeat}
          dateLabel={dateOptions.find((option) => option.value === selectedDate)?.label ?? selectedDate}
          hourLabel={formatHourLabel(effectiveHour)}
          isNotified={isNotified}
          hasOtherBookingThisSlot={hasOtherBookingThisSlot}
          isBusy={isBusy}
          myBookings={myBookings}
          onConfirm={confirmBooking}
          onCancelBooking={cancelBooking}
          onRequestNotify={requestNotify}
        />
      </div>
    </div>
  );
}
