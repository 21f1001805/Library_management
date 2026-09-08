// Mirrors backend/src/app/modules/loans/constants.py.
export const LOAN_PERIOD_DAYS = 14;
export const FINE_PER_DAY = 50;

// Manager-approved reservations pick one of these instead of the flat LOAN_PERIOD_DAYS.
export const RESERVATION_DURATION_CHOICES = [3, 5, 7, 10] as const;

// How many days before a loan's due date the daily background job starts nudging.
export const REMINDER_WINDOW_DAYS = 2;

// Don't re-nudge the same loan inside this window.
export const REMIND_COOLDOWN_HOURS = 20;
