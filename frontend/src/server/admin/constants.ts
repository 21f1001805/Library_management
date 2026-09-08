// Mirrors backend/src/app/modules/admin/constants.py.
export const ExpenseCategory = {
  STAFF_SALARIES: 'staffSalaries',
  BOOK_PROCUREMENT: 'bookProcurement',
  UTILITIES: 'utilities',
  MARKETING: 'marketing',
} as const;
export type ExpenseCategoryValue = (typeof ExpenseCategory)[keyof typeof ExpenseCategory];

// ponytail: fixed monthly budget per category — no "set budget" feature exists yet, so
// these are constants until admins can configure them.
export const EXPENSE_BUDGETS: Record<string, number> = {
  [ExpenseCategory.STAFF_SALARIES]: 6000,
  [ExpenseCategory.BOOK_PROCUREMENT]: 2500,
  [ExpenseCategory.UTILITIES]: 900,
  [ExpenseCategory.MARKETING]: 700,
};

// Hall is open 9 AM - 8 PM, matching the seat-booking feature's hours.
export const OPEN_HOURS = Array.from({ length: 12 }, (_, i) => i + 9);
