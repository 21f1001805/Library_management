import { execFile } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { env } from '@/server/env';
import * as guardianService from '@/server/guardian/service';
import * as loansService from '@/server/loans/service';
import { seedDevAccounts } from '@/server/seed/seedDevAccounts';
import { seedBooks } from '@/server/seed/seedBooks';
import { seedDemoData } from '@/server/seed/seedDemoData';
import { seedDailyRefresh } from '@/server/seed/seedDailyRefresh';
import { seedVisits } from '@/server/seed/seedVisits';
import { backfillBookEmbeddings } from '@/server/seed/backfillBookEmbeddings';

// Mirrors backend/src/app/main.py's lifespan: apply-migrations-then-seed-then-loop
// startup sequence, run here as its own persistent Node process (started alongside
// `next start`, e.g. via `bun run start:jobs`) rather than inside a Next.js Route
// Handler — a request-driven server has no persistent in-process runtime that could
// host a loop outliving any one request. See the migration plan's "Background jobs"
// decision (frontend/../.claude/plans, or nextjs_migration_backend_scope memory) for
// why this is a separate process instead of a custom server entry.
//
// The Python backend has been fully retired — the 6 seed scripts below are now direct
// TS ports (frontend/src/server/seed/*.ts) instead of subprocess calls into
// backend/scripts/*.py.

const execFileAsync = promisify(execFile);

const FRONTEND_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const SCHEMA_PATH = path.join(FRONTEND_ROOT, 'prisma', 'schema.prisma');
const PRISMA_CLI = path.join(FRONTEND_ROOT, 'node_modules', 'prisma', 'build', 'index.js');

const REMINDER_LOOP_INTERVAL_MS = 24 * 60 * 60 * 1000;

// Bring the schema up to date before anything runs. `migrate deploy` is idempotent and
// holds an advisory lock for the duration, so this is safe to run alongside the Next.js
// server (or several job-runner instances) starting at once. Invoked as `node <cli.js>
// ...` rather than relying on a `prisma`/`bunx` binary being on PATH — mirrors Python's
// own `sys.executable -m prisma ...` (calling the interpreter directly), portable across
// platforms the same way.
async function applyPendingMigrations(): Promise<void> {
  let stdout: string;
  try {
    ({ stdout } = await execFileAsync(
      process.execPath,
      [PRISMA_CLI, 'migrate', 'deploy', '--schema', SCHEMA_PATH],
      { cwd: FRONTEND_ROOT, env: { ...process.env, DATABASE_URL: env.DATABASE_URL } },
    ));
  } catch (err) {
    const output = err instanceof Error ? err.message : String(err);
    console.error(`prisma migrate deploy failed: ${output}`);
    throw new Error('Database migrations failed; refusing to start');
  }

  const output = stdout.trim();
  if (output.includes('No pending migrations')) {
    console.log('database schema already up to date');
  } else {
    console.log('applied pending database migrations');
  }
}

// Dev-only convenience: book catalog + ~5 months of synthetic activity, so a fresh
// clone has something to look at without anyone running the seed scripts by hand. Every
// step here is idempotent (seedBooks upserts on ISBN, seedDemoData skips once it finds
// its own seeded users, ...), so this is a quick no-op on every boot after the first.
// One bad step logs a warning and stops the remaining steps, but never fails the boot —
// missing demo data doesn't stop the loops below from starting.
const DEMO_SEED_STEPS: [string, () => Promise<string>][] = [
  ['seedDevAccounts', seedDevAccounts],
  ['seedBooks', seedBooks],
  ['seedDemoData', seedDemoData],
  // Unlike the two above, this one is never "already seeded" — it re-checks a few
  // time-relative facts (this month's reading progress, today's seat occupancy, whether
  // any event is still upcoming) on every boot and only tops up what's short.
  ['seedDailyRefresh', seedDailyRefresh],
  // Seeds active + historical library visit records so the Check-In/Check-Out card
  // shows real data on a fresh clone. Idempotent — skips if active visits exist.
  ['seedVisits', seedVisits],
  // Not required for correctness (getRelatedBooks computes embeddings lazily), but runs
  // the ~400 embed calls once up front here instead of on whichever member's request
  // happens to hit an un-embedded book first.
  ['backfillBookEmbeddings', backfillBookEmbeddings],
];

async function seedDevDemoData(): Promise<void> {
  for (const [name, step] of DEMO_SEED_STEPS) {
    try {
      const line = await step();
      console.log(`${name}: ${line}`);
    } catch (err) {
      console.warn(`${name} failed, skipping remaining demo seed steps:`, err);
      return;
    }
  }
}

// One bad run shouldn't kill the loop, but it must not vanish silently either. Runs
// sequentially (next call scheduled only after the previous one settles, success or
// failure) rather than on a fixed setInterval, so a slow run can never overlap with the
// next tick — same effect as Python's `await fn(); await asyncio.sleep(interval)`.
function startDailyLoop(name: string, fn: () => Promise<void>): { stop: () => void } {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  async function tick(): Promise<void> {
    try {
      await fn();
    } catch (err) {
      console.error(`${name} failed:`, err);
    }
    if (!stopped) timer = setTimeout(tick, REMINDER_LOOP_INTERVAL_MS);
  }

  void tick();
  return {
    stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
    },
  };
}

async function main(): Promise<void> {
  if (env.APP_ENV !== 'test') {
    if (env.AUTO_MIGRATE) await applyPendingMigrations();
    // development only — excludes "e2e" (Playwright seeds its own fixed fixtures) and
    // "test" (whole startup block skipped above).
    if (env.APP_ENV === 'development' && env.AUTO_SEED_DEMO) await seedDevDemoData();
  }

  // This is an in-process timer loop — running N job-runner instances means N
  // independent sweep loops, each on its own timer. That's safe from duplicate sends
  // only because sendDueSoonReminders()/sendMonthlyReadingDigests() check a DB-backed
  // cooldown (Loan.lastRemindedAt / GuardianLink.lastDigestSentAt) before nudging, not
  // because of anything here. Don't remove those checks without accounting for
  // multi-instance duplicate reminders.
  const reminderLoop = startDailyLoop('send_due_soon_reminders', loansService.sendDueSoonReminders);
  // Same shape as the reminder loop: runs daily, but sendMonthlyReadingDigests() itself
  // decides whether a given guardian-child link is actually due this calendar month —
  // the loop's own interval only bounds how quickly a newly-due link gets picked up.
  const guardianLoop = startDailyLoop('send_monthly_reading_digests', guardianService.sendMonthlyReadingDigests);

  console.log(
    `Job runner started — env=${env.APP_ENV} db=${env.DATABASE_URL.split('@').pop()} redis=${env.REDIS_URL}`,
  );

  function shutdown(): void {
    console.log('Job runner shutting down...');
    reminderLoop.stop();
    guardianLoop.stop();
    process.exit(0);
  }
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Job runner failed to start:', err);
  process.exit(1);
});
