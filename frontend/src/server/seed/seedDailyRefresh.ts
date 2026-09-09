import type { User, Book } from '@prisma/client';
import { Prisma } from '@prisma/client';

import { prisma } from '@/server/db';
import { env } from '@/server/env';
import { Role } from '@/server/constants';
import { LOAN_PERIOD_DAYS } from '@/server/loans/constants';
import { SEAT_LABELS } from '@/server/seatBooking/constants';
import { countCompletedReadingProgress } from '@/server/members/repository';
import { SeededRandom, stableIndex } from '@/server/seed/random';
import {
  EXTRA_EVENT_TITLES,
  HUMANIZED_POST_TEMPLATES,
  REVIEW_TEMPLATES,
  RETIRED_SHORT_POST_TEMPLATES,
  SUPPORT_DESCRIPTIONS,
} from '@/server/seed/constants';

// Mirrors backend/scripts/seed_daily_refresh.py. Daily freshness top-up for demo data:
// seedDemoData.ts seeds one historical batch and then skips forever, but a handful of
// facts are inherently "as of today" (this month's reading-goal progress, today's seat
// occupancy, whether any event is still upcoming) and would silently go stale the day
// after that batch was seeded. This top-up runs on every job-runner boot: it mostly adds
// rows to close a gap it finds *right now*, plus two narrow in-place fixes (rewriting a
// short post's content, deleting a fixed list of retired first-draft post templates) —
// both scoped to specific rows by exact content match, never a blanket edit/delete.
// Every check is a count/lookup first, so an already-topped-up day is a fast no-op.

const SEEDABLE_ENVIRONMENTS = new Set(['development', 'test', 'e2e']);
const SEED_EMAIL_DOMAIN = '@seed-demo.example.com';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function addMs(date: Date, ms: number): Date {
  return new Date(date.getTime() + ms);
}

const TOTAL_SEATS = SEAT_LABELS.length;
const DAY_HOURS = new Set(Array.from({ length: 12 }, (_, i) => i + 9));
const PEAK_HOURS = new Set([13, 18]);
const DAY_TARGET = Math.ceil(TOTAL_SEATS * 0.6);
const NIGHT_TARGET = Math.ceil(TOTAL_SEATS * 0.3);
// A real library is never booked to the very last seat — leave some headroom so a
// walk-in member always sees at least one open seat, even during a "peak" hour.
const MAX_OCCUPANCY_FRACTION = 0.9;
const MAX_SEAT_TARGET = Math.floor(TOTAL_SEATS * MAX_OCCUPANCY_FRACTION);

const POPULAR_BOOK_REVIEWS: [number, number] = [10, 16];
const NORMAL_BOOK_REVIEWS: [number, number] = [6, 7];
const POPULAR_FRACTION = 0.2;
const MEMBER_TICKET_CATEGORIES = [
  'book_reservation', 'payment', 'seat_booking', 'harassment', 'offline_library', 'other',
];
const MIN_TICKETS_PER_MEMBER = 2;
const MIN_MONTHLY_BOOKS = 4;
const MIN_UPCOMING_EVENTS = 3;

function seatTarget(hour: number): number {
  const target = PEAK_HOURS.has(hour) ? TOTAL_SEATS : DAY_HOURS.has(hour) ? DAY_TARGET : NIGHT_TARGET;
  return Math.min(target, MAX_SEAT_TARGET);
}

// Today only — "today" resets to zero bookings every day, so this is the one piece that
// must actually run daily rather than just being safe to.
async function topUpSeatOccupancy(RNG: SeededRandom, members: User[]): Promise<string> {
  const today = new Date();
  const dayKey = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  let added = 0;
  let trimmed = 0;
  for (let hour = 0; hour < 24; hour++) {
    const target = seatTarget(hour);
    const existing = await prisma.seatBooking.findMany({ where: { date: dayKey, hour } });
    const needed = target - existing.length;
    if (needed < 0) {
      // A lower cap than a previous run used can leave today's data over the current
      // target — trim back down rather than leaving stale over-capacity bookings until
      // they roll off with the day.
      const excess = RNG.sample(existing, -needed);
      for (const booking of excess) {
        await prisma.seatBooking.delete({ where: { id: booking.id } });
        trimmed += 1;
      }
      continue;
    }
    if (needed === 0) continue;
    const takenSeats = new Set(existing.map((b) => b.seatLabel));
    const takenMembers = new Set(existing.map((b) => b.memberId));
    const freeSeats = SEAT_LABELS.filter((s) => !takenSeats.has(s));
    const candidates = members.filter((m) => !takenMembers.has(m.id));
    RNG.shuffle(freeSeats);
    RNG.shuffle(candidates);
    const pairs = Math.min(freeSeats.length, candidates.length, needed);
    for (let i = 0; i < pairs; i++) {
      try {
        await prisma.seatBooking.create({
          data: { memberId: candidates[i].id, seatLabel: freeSeats[i], date: dayKey, hour },
        });
        added += 1;
      } catch (err) {
        if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) throw err;
      }
    }
  }
  const line = `Seat occupancy top-up: added ${added}, trimmed ${trimmed} bookings for ${dayKey.toISOString().slice(0, 10)}.`;
  console.log(line);
  return line;
}

// Ensures a reading goal exists and this month's completed-book count is >= 4, creating
// a fast on-time loan + completed progress + review for each book needed to close the
// gap — so "read" and "reviewed" stay true together.
async function topUpReadingActivity(RNG: SeededRandom, members: User[], books: Book[], issuers: User[]): Promise<string> {
  const now = new Date();
  const monthStartD = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  let goalsCreated = 0;
  let loansCreated = 0;
  let reviewsCreated = 0;

  for (const member of members) {
    const existingGoal = await prisma.readingGoal.findUnique({ where: { memberId: member.id } });
    if (!existingGoal) {
      await prisma.readingGoal.create({
        data: { memberId: member.id, yearlyGoal: 48, monthlyGoal: MIN_MONTHLY_BOOKS },
      });
      goalsCreated += 1;
    }

    const completed = await countCompletedReadingProgress(member.id, monthStartD);
    if (completed >= MIN_MONTHLY_BOOKS) continue;

    const alreadyRead = await prisma.readingProgress.findMany({ where: { memberId: member.id } });
    const readIds = new Set(alreadyRead.map((r) => r.bookId));
    const pool = books.filter((b) => !readIds.has(b.id));
    RNG.shuffle(pool);

    for (const book of pool.slice(0, MIN_MONTHLY_BOOKS - completed)) {
      const spanStart = member.createdAt > monthStartD ? member.createdAt : monthStartD;
      const spanSeconds = Math.max(1, Math.floor((now.getTime() - spanStart.getTime()) / SECOND));
      let borrowedAt = addMs(spanStart, RNG.randint(0, spanSeconds) * SECOND);
      const latestBorrow = addMs(now, -2 * HOUR);
      if (borrowedAt > latestBorrow) borrowedAt = latestBorrow;
      let returnedAt = addMs(borrowedAt, RNG.randint(6, 96) * HOUR);
      if (returnedAt >= now) returnedAt = addMs(now, -RNG.randint(5, 60) * MINUTE);
      if (returnedAt <= borrowedAt) returnedAt = addMs(borrowedAt, 30 * MINUTE);

      const issuer = RNG.choice(issuers);
      await prisma.loan.create({
        data: {
          bookId: book.id,
          memberId: member.id,
          borrowedAt,
          dueDate: addMs(borrowedAt, LOAN_PERIOD_DAYS * DAY),
          returnedAt,
          createdById: issuer.id,
          createdAt: borrowedAt,
        },
      });
      loansCreated += 1;
      await prisma.readingProgress.create({
        data: { memberId: member.id, bookId: book.id, status: 'completed', percentComplete: 100, updatedAt: returnedAt },
      });
      try {
        // Clamped to now: a book returned today plus the review lag landed in tomorrow,
        // and future-dated rows sort above real ones in newest-first review lists
        // (which are capped, so genuinely new reviews fell off the end entirely).
        const reviewCreatedAt = new Date(
          Math.min(addMs(returnedAt, RNG.randint(1, 20) * HOUR).getTime(), Date.now()),
        );
        await prisma.review.create({
          data: {
            bookId: book.id,
            memberId: member.id,
            rating: RNG.choices([3, 4, 5, 2], [25, 40, 25, 10], 1)[0],
            comment: RNG.choice(REVIEW_TEMPLATES),
            images: [],
            createdAt: reviewCreatedAt,
          },
        });
        reviewsCreated += 1;
      } catch (err) {
        if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) throw err;
      }
    }
  }

  const line =
    `Reading-goal top-up: ${goalsCreated} goals created, ${loansCreated} catch-up loans ` +
    `(+matching reviews: ${reviewsCreated}) so every member has ${MIN_MONTHLY_BOOKS}+ books completed this month.`;
  console.log(line);
  return line;
}

// Independent of who actually borrowed a book — every book gets a review-count floor
// (more for popular ones), since a rarely-borrowed book still needs reviews to look real.
async function topUpBookReviews(RNG: SeededRandom, books: Book[], members: User[]): Promise<string> {
  const loanRows = await prisma.$queryRaw<{ book_id: string; n: number }[]>`
    SELECT book_id::text AS book_id, COUNT(*)::int AS n FROM loans GROUP BY book_id`;
  const loanCounts = new Map(loanRows.map((row) => [row.book_id, row.n]));
  const ranked = [...books].sort((a, b) => (loanCounts.get(b.id) ?? 0) - (loanCounts.get(a.id) ?? 0));
  const popularIds = new Set(ranked.slice(0, Math.max(1, Math.floor(ranked.length * POPULAR_FRACTION))).map((b) => b.id));

  const reviewersByBook = new Map<string, Set<string>>();
  for (const review of await prisma.review.findMany()) {
    const set = reviewersByBook.get(review.bookId) ?? new Set<string>();
    set.add(review.memberId);
    reviewersByBook.set(review.bookId, set);
  }

  let created = 0;
  for (const book of books) {
    const have = reviewersByBook.get(book.id) ?? new Set<string>();
    const [low, high] = popularIds.has(book.id) ? POPULAR_BOOK_REVIEWS : NORMAL_BOOK_REVIEWS;
    // Keyed by the book's own id rather than drawn from the shared RNG stream, so the
    // target for a given book is the same on every run regardless of how much other
    // work happened earlier in the run.
    const target = low + stableIndex(book.id, high - low + 1);
    const needed = target - have.size;
    if (needed <= 0) continue;
    const candidates = members.filter((m) => !have.has(m.id));
    RNG.shuffle(candidates);
    for (const member of candidates.slice(0, needed)) {
      await prisma.review.create({
        data: {
          bookId: book.id,
          memberId: member.id,
          rating: RNG.choices([3, 4, 5, 2, 1], [28, 35, 24, 9, 4], 1)[0],
          comment: RNG.choice(REVIEW_TEMPLATES),
          images: [],
          createdAt: addMs(new Date(), -(RNG.randint(0, 60) * DAY + RNG.randint(0, 23) * HOUR)),
        },
      });
      created += 1;
      have.add(member.id);
    }
  }
  const line = `Book review top-up: added ${created} reviews across ${books.length} books.`;
  console.log(line);
  return line;
}

const MIN_POST_WORDS = 70;
const ENGLISH_TEMPLATES = HUMANIZED_POST_TEMPLATES.filter(([lang]) => lang === 'English').map(([, t]) => t);
// Devanagari through Malayalam is one contiguous Unicode block (covers every Indic
// script this seed data uses) — used to tell "genuinely non-English" apart from
// "English text that happens to contain a non-ASCII em dash or ₹ sign".
const INDIC_SCRIPT_RE = /[ऀ-ൿ]/;

// The original seedDemoData.ts posts were one-liners — this rewrites any post under the
// word-count floor in place (same id/author/createdAt), so comments/likes/saves
// attached to it (keyed by postId, not content) survive. Only touches posts with no
// Indic-script characters — a non-English post measuring under 70 by a naive
// whitespace split isn't actually thin, that script just tokenizes differently.
async function lengthenShortPosts(): Promise<string> {
  const posts = await prisma.communityPost.findMany();
  let rewritten = 0;
  for (const post of posts) {
    if (INDIC_SCRIPT_RE.test(post.content) || post.content.split(/\s+/).filter(Boolean).length >= MIN_POST_WORDS) {
      continue;
    }
    const title = post.bookTitle || 'this book';
    const template = ENGLISH_TEMPLATES[rewritten % ENGLISH_TEMPLATES.length];
    await prisma.communityPost.update({
      where: { id: post.id },
      data: { content: template.replace('{title}', title) },
    });
    rewritten += 1;
  }
  const line = `Post lengthening: rewrote ${rewritten} short posts to ${MIN_POST_WORDS}+ words each.`;
  console.log(line);
  return line;
}

// Long-form, first-person community posts (English + 8 Indian languages) that read like
// a real member wrote them, not a one-line AI summary. One-time per template (not
// day-relative) — only ever creates the ones still missing. `books`/`members` MUST be
// sorted by id by the caller before this runs (Postgres doesn't guarantee stable row
// order across calls — an unstable order silently reshuffled the pairing and made this
// top-up re-create "new" posts forever instead of converging).
async function topUpHumanizedPosts(RNG: SeededRandom, sortedMembers: User[], sortedBooks: Book[]): Promise<string> {
  let retired = 0;
  for (const oldTemplate of RETIRED_SHORT_POST_TEMPLATES) {
    const book = sortedBooks[stableIndex(oldTemplate, sortedBooks.length)];
    const oldContent = oldTemplate.replace('{title}', book.title);
    const { count } = await prisma.communityPost.deleteMany({ where: { content: oldContent } });
    retired += count;
  }

  let created = 0;
  for (const [, template] of HUMANIZED_POST_TEMPLATES) {
    const book = sortedBooks[stableIndex(template, sortedBooks.length)];
    const author = sortedMembers[stableIndex(`${template}|author`, sortedMembers.length)];
    const content = template.replace('{title}', book.title);
    const alreadyExists = await prisma.communityPost.findFirst({ where: { content } });
    if (alreadyExists) continue;
    await prisma.communityPost.create({
      data: {
        authorId: author.id,
        bookTitle: book.title,
        content,
        images: [],
        createdAt: addMs(new Date(), -(RNG.randint(0, 30) * DAY + RNG.randint(0, 23) * HOUR)),
      },
    });
    created += 1;
  }
  const languages = [...new Set(HUMANIZED_POST_TEMPLATES.map(([lang]) => lang))].sort();
  const line =
    `Humanized posts top-up: retired ${retired} old one-liners, added ${created} long-form posts ` +
    `across ${languages.length} languages (${languages.join(', ')}).`;
  console.log(line);
  return line;
}

async function topUpSupportTickets(RNG: SeededRandom, members: User[], staffPool: User[]): Promise<string> {
  let created = 0;
  for (const member of members) {
    const existingCount = await prisma.supportTicket.count({ where: { raisedById: member.id } });
    if (existingCount >= MIN_TICKETS_PER_MEMBER) continue;
    for (let n = 0; n < MIN_TICKETS_PER_MEMBER - existingCount; n++) {
      const category = RNG.choice(MEMBER_TICKET_CATEGORIES);
      const createdAt = addMs(new Date(), -(RNG.randint(0, 25) * DAY + RNG.randint(0, 23) * HOUR));
      const status = RNG.choices(['open', 'resolved', 'closed'], [40, 35, 25], 1)[0];
      const resolver = RNG.choice(staffPool);
      const resolvedAt = status !== 'open' ? addMs(createdAt, RNG.randint(1, 4) * DAY) : null;
      const closedAt = status === 'closed' && resolvedAt ? addMs(resolvedAt, DAY) : null;
      await prisma.supportTicket.create({
        data: {
          raisedById: member.id,
          category,
          description: SUPPORT_DESCRIPTIONS[category],
          status,
          resolutionNote: status !== 'open' ? 'Resolved after reviewing account activity.' : null,
          resolvedById: status !== 'open' ? resolver.id : null,
          resolvedAt,
          closedAt,
          createdAt,
        },
      });
      created += 1;
    }
  }
  const line = `Support-ticket top-up: added ${created} tickets (every member now has ${MIN_TICKETS_PER_MEMBER}+).`;
  console.log(line);
  return line;
}

async function topUpUpcomingEvents(RNG: SeededRandom, creators: User[], members: User[], guardians: User[], books: Book[]): Promise<string> {
  const now = new Date();
  const upcoming = await prisma.event.count({ where: { date: { gt: now }, deletedAt: null } });
  if (upcoming >= MIN_UPCOMING_EVENTS) {
    const line = `Upcoming events: ${upcoming} already scheduled — nothing to add.`;
    console.log(line);
    return line;
  }

  const attendeesPool = [...members, ...guardians];
  let created = 0;
  for (let n = 0; n < MIN_UPCOMING_EVENTS - upcoming; n++) {
    const book = RNG.choice(books);
    const creator = RNG.choice(creators);
    const capacity = RNG.choice([15, 20, 25, 30]);
    const event = await prisma.event.create({
      data: {
        title: RNG.choice(EXTRA_EVENT_TITLES),
        description: `Join us to discuss ${book.title} and connect with fellow readers.`,
        location: 'Main Reading Hall',
        date: addMs(now, RNG.randint(3, 21) * DAY + RNG.randint(0, 10) * HOUR),
        capacity,
        createdBy: creator.id,
      },
    });
    created += 1;
    const registrantCount = RNG.randint(3, Math.max(3, Math.floor(capacity / 2)));
    const registrants = RNG.sample(attendeesPool, Math.min(attendeesPool.length, registrantCount));
    for (const member of registrants) {
      try {
        await prisma.eventRegistration.create({ data: { eventId: event.id, memberId: member.id } });
      } catch (err) {
        if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) throw err;
      }
    }
  }
  const line = `Upcoming-events top-up: added ${created} new events.`;
  console.log(line);
  return line;
}

export async function seedDailyRefresh(): Promise<string> {
  if (!SEEDABLE_ENVIRONMENTS.has(env.APP_ENV)) {
    const line = `Skipping daily refresh — APP_ENV=${JSON.stringify(env.APP_ENV)} is not a dev/demo environment.`;
    console.log(line);
    return line;
  }

  // Deterministic within a day (so re-running the same day doesn't reshuffle choices
  // already made), but different from one day to the next.
  const todayKey = parseInt(new Date().toISOString().slice(0, 10).replace(/-/g, ''), 10);
  const RNG = new SeededRandom(todayKey);

  // Demo accounts only. Selecting every member would also sweep in the
  // *-test.example.com users a local pytest run leaves behind, and attaching reading
  // progress/goals to those breaks the suite's own teardown.
  const members = (
    await prisma.user.findMany({ where: { role: { name: Role.MEMBER }, deletedAt: null, email: { endsWith: SEED_EMAIL_DOMAIN } } })
  ).sort((a, b) => a.id.localeCompare(b.id));
  const guardians = await prisma.user.findMany({
    where: { role: { name: Role.GUARDIAN }, deletedAt: null, email: { endsWith: SEED_EMAIL_DOMAIN } },
  });
  const managersAndLibrarians = await prisma.user.findMany({
    where: { role: { name: { in: [Role.MANAGER, Role.LIBRARIAN] } }, deletedAt: null },
  });
  const staffCreators = await prisma.user.findMany({
    where: { role: { name: { in: [Role.MANAGER, Role.ADMIN] } }, deletedAt: null },
  });
  const staffPool = await prisma.user.findMany({
    where: { role: { name: { in: [Role.ADMIN, Role.MANAGER, Role.IT_HEAD] } }, deletedAt: null },
  });
  // Sorted by id (not insertion/query order, which Postgres doesn't guarantee stable
  // across calls) so stableIndex() picks the same book for a given template on every
  // run — see topUpHumanizedPosts's docstring.
  const books = (await prisma.book.findMany({ where: { deletedAt: null } })).sort((a, b) => a.id.localeCompare(b.id));

  if (members.length === 0 || books.length === 0 || managersAndLibrarians.length === 0) {
    const line = 'No seed data present yet (members/books/staff) — skipping daily refresh.';
    console.log(line);
    return line;
  }

  await topUpBookReviews(RNG, books, members);
  await topUpReadingActivity(RNG, members, books, managersAndLibrarians);
  await lengthenShortPosts();
  await topUpHumanizedPosts(RNG, members, books);
  await topUpSupportTickets(RNG, members, staffPool);
  await topUpUpcomingEvents(RNG, staffCreators, members, guardians, books);
  await topUpSeatOccupancy(RNG, members);
  const line = 'Daily refresh complete.';
  console.log(line);
  return line;
}
