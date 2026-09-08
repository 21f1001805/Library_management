// Mirrors backend/src/app/modules/seat_booking/constants.py.
const SEAT_ROWS = ['A', 'B', 'C', 'D'];
const SEATS_PER_ROW = 8;
export const SEAT_LABELS: string[] = SEAT_ROWS.flatMap((row) =>
  Array.from({ length: SEATS_PER_ROW }, (_, i) => `${row}${i + 1}`),
);

// Bookable window: today plus this many additional days.
export const MAX_DAYS_AHEAD = 2;
