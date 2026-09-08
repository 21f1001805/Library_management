// Mirrors backend/src/app/modules/payments/service.py's calculate_membership_expiry —
// a pure function, ported as-is. Order creation/Razorpay verification is phase 6.
function daysInMonth(year: number, month1to12: number): number {
  // Day 0 of the month after `month1to12` (0-based) is the last day of `month1to12`.
  return new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
}

export function calculateMembershipExpiry(
  payments: { createdAt: Date; planMonths: number | null }[],
): Date | null {
  if (payments.length === 0) return null;

  let expiresAt = payments[0].createdAt;
  for (const payment of payments) {
    const base = payment.createdAt > expiresAt ? payment.createdAt : expiresAt;
    const monthIndex = base.getUTCMonth() + (payment.planMonths ?? 0);
    const year = base.getUTCFullYear() + Math.floor(monthIndex / 12);
    const month = (monthIndex % 12) + 1;
    const day = Math.min(base.getUTCDate(), daysInMonth(year, month));
    expiresAt = new Date(
      Date.UTC(
        year,
        month - 1,
        day,
        base.getUTCHours(),
        base.getUTCMinutes(),
        base.getUTCSeconds(),
        base.getUTCMilliseconds(),
      ),
    );
  }
  return expiresAt;
}
