# ponytail: fixed loan period + flat per-day fine — no per-plan/per-book-category
# variation yet, matches how EXPENSE_BUDGETS is a flat constant until a "configure this"
# UI exists.
LOAN_PERIOD_DAYS = 14
FINE_PER_DAY = 50

# Manager-approved reservations pick one of these instead of the flat LOAN_PERIOD_DAYS.
RESERVATION_DURATION_CHOICES = (3, 5, 7, 10)

# How many days before a loan's due date the daily background job starts nudging.
REMINDER_WINDOW_DAYS = 2
