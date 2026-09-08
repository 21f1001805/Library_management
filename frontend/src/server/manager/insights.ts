// Mirrors backend/src/app/modules/manager/insights.py exactly — pure, deterministic
// scoring logic (trend comparison, historical rate), not an LLM call. Neither function
// is wired into any automatic action; both feed read-only dashboard cards.

export const DEMAND_RECENT_WINDOW_DAYS = 30;
export const DEMAND_PRIOR_WINDOW_DAYS = 30;
// A book with zero activity a month ago needs at least this many loans/reservations in
// the recent window before "went from 0 to something" counts as a real signal rather
// than a single one-off borrow.
const DEMAND_MIN_NEW_ACTIVITY = 2;
const DEMAND_HIGH_GROWTH_PCT = 50.0;
const DEMAND_MEDIUM_GROWTH_PCT = 15.0;
export const DEMAND_RESULT_LIMIT = 10;

export type DemandLevel = 'high' | 'medium';

export interface DemandSignal {
  bookId: string;
  recentActivity: number;
  priorActivity: number;
  pendingReservations: number;
  totalCopies: number;
}

export interface DemandForecast {
  recentActivity: number;
  priorActivity: number;
  changePct: number | null;
  pendingReservations: number;
  demandLevel: DemandLevel;
  reason: string;
}

function demandReason(signal: DemandSignal, changePct: number | null): string {
  let base: string;
  if (changePct === null) {
    base =
      `${signal.recentActivity} loan(s)/reservation(s) in the last ${DEMAND_RECENT_WINDOW_DAYS} days, ` +
      `none in the previous ${DEMAND_PRIOR_WINDOW_DAYS}`;
  } else {
    const sign = changePct >= 0 ? '+' : '';
    base =
      `${signal.recentActivity} loan(s)/reservation(s) in the last ${DEMAND_RECENT_WINDOW_DAYS} days ` +
      `vs ${signal.priorActivity} in the previous ${DEMAND_PRIOR_WINDOW_DAYS} (${sign}${changePct.toFixed(0)}%)`;
  }
  if (signal.pendingReservations > 0) {
    base += `; ${signal.pendingReservations} member(s) waiting on a reservation`;
  }
  if (signal.totalCopies > 0 && signal.pendingReservations >= signal.totalCopies) {
    const copyWord = signal.totalCopies === 1 ? 'copy is' : 'copies are';
    base += ` — all ${signal.totalCopies} ${copyWord} already claimed`;
  }
  return base;
}

// null means there isn't enough signal to call this book trending — never invents a
// level for a book with little or no recent activity.
export function scoreDemand(signal: DemandSignal): DemandForecast | null {
  if (signal.recentActivity === 0) return null;

  let changePct: number | null;
  let trendLevel: DemandLevel | null;
  if (signal.priorActivity === 0) {
    if (signal.recentActivity < DEMAND_MIN_NEW_ACTIVITY) return null;
    changePct = null;
    trendLevel = 'high';
  } else {
    changePct = ((signal.recentActivity - signal.priorActivity) / signal.priorActivity) * 100;
    if (changePct >= DEMAND_HIGH_GROWTH_PCT) trendLevel = 'high';
    else if (changePct >= DEMAND_MEDIUM_GROWTH_PCT) trendLevel = 'medium';
    else trendLevel = null;
  }

  // Every available copy already spoken for is a directly observed supply shortfall,
  // not a trend inference — worth surfacing (at least as "medium") even when the
  // recent-vs-prior trend itself doesn't clear a growth threshold.
  const unmetDemand = signal.totalCopies > 0 && signal.pendingReservations >= signal.totalCopies;

  if (trendLevel === null && !unmetDemand) return null;

  const level: DemandLevel = trendLevel === 'high' || unmetDemand ? 'high' : 'medium';

  return {
    recentActivity: signal.recentActivity,
    priorActivity: signal.priorActivity,
    changePct,
    pendingReservations: signal.pendingReservations,
    demandLevel: level,
    reason: demandReason(signal, changePct),
  };
}

// ── Late-return risk ─────────────────────────────────────────────────────────
const RISK_MEDIUM_MIN = 34;
const RISK_HIGH_MIN = 67;
const RISK_SCORE_CAP = 97; // never claim near-certainty — this is a heuristic, not a guarantee
const OVERDUE_BONUS = 40.0;
const DUE_SOON_DAYS = 2;
const DUE_SOON_BONUS = 15.0;
export const LATE_RETURN_RESULT_LIMIT = 20;

export type RiskLevel = 'low' | 'medium' | 'high';

export interface MemberLoanHistory {
  lateReturns: number;
  totalReturns: number;
}

export interface LateReturnRisk {
  riskScore: number;
  riskLevel: RiskLevel;
  reason: string;
}

function daysBetweenUtcDates(a: Date, b: Date): number {
  const aUtc = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
  const bUtc = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
  return Math.round((aUtc - bUtc) / 86_400_000);
}

// memberHistory is null for a member with no returned loans yet — falls back to the
// library-wide average rather than assuming 0% or 100% for a borrower with no track
// record (both would be inventing a result the data doesn't support).
export function scoreLateReturnRisk(opts: {
  dueDate: Date;
  now: Date;
  memberHistory: MemberLoanHistory | null;
  libraryWideLateRatePct: number;
}): LateReturnRisk {
  let lateRatePct: number;
  let historyNote: string;
  if (opts.memberHistory !== null && opts.memberHistory.totalReturns > 0) {
    lateRatePct = (opts.memberHistory.lateReturns / opts.memberHistory.totalReturns) * 100;
    historyNote = `returned ${opts.memberHistory.lateReturns} of ${opts.memberHistory.totalReturns} past loan(s) late (${lateRatePct.toFixed(0)}%)`;
  } else {
    lateRatePct = opts.libraryWideLateRatePct;
    historyNote = `no return history yet — using the library-wide average (${lateRatePct.toFixed(0)}%)`;
  }

  const daysOverdue = Math.max(0, daysBetweenUtcDates(opts.now, opts.dueDate));
  const daysUntilDue = daysBetweenUtcDates(opts.dueDate, opts.now);

  let score = lateRatePct;
  let statusNote: string;
  if (daysOverdue > 0) {
    score += OVERDUE_BONUS;
    statusNote = `already ${daysOverdue} day(s) overdue`;
  } else if (daysUntilDue >= 0 && daysUntilDue <= DUE_SOON_DAYS) {
    score += DUE_SOON_BONUS;
    statusNote = `due in ${daysUntilDue} day(s)`;
  } else {
    statusNote = `due in ${daysUntilDue} day(s)`;
  }

  const scoreInt = Math.max(0, Math.min(RISK_SCORE_CAP, Math.round(score)));
  let level: RiskLevel;
  if (scoreInt >= RISK_HIGH_MIN) level = 'high';
  else if (scoreInt >= RISK_MEDIUM_MIN) level = 'medium';
  else level = 'low';

  const reason = `${historyNote.charAt(0).toUpperCase()}${historyNote.slice(1)}; ${statusNote}.`;

  return { riskScore: scoreInt, riskLevel: level, reason };
}
