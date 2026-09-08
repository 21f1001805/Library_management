// Minimal subset of backend/src/app/modules/members/service.py — just compute_streaks,
// a pure function leaderboard needs. The rest of that module (member CRUD, reading-
// progress/goal/streak endpoints, the LLM-backed reading-profile) is a later phase.

function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  return toDateKey(new Date(Date.UTC(y, m - 1, d + days)));
}

// Returns [currentStreak, longestStreak]. loginDates are calendar-date keys ("YYYY-MM-DD").
export function computeStreaks(loginDates: Set<string>): [number, number] {
  if (loginDates.size === 0) return [0, 0];

  const today = toDateKey(new Date());

  // Current streak counts backward from the most recent login day. If that's today or
  // yesterday the streak is still "alive" (grace period for not having logged in yet
  // today); anything older than that means the streak is broken.
  let cursor = loginDates.has(today) ? today : addDays(today, -1);
  let current = 0;
  while (loginDates.has(cursor)) {
    current += 1;
    cursor = addDays(cursor, -1);
  }

  let longest = 0;
  let run = 0;
  for (const day of [...loginDates].sort()) {
    run = loginDates.has(addDays(day, -1)) ? run + 1 : 1;
    longest = Math.max(longest, run);
  }

  return [current, longest];
}
