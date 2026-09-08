import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import type { Prisma } from '@prisma/client';

import { buildChatLlm, extractJsonObject, logLlmFailure } from '@/server/llm';
import * as booksRepository from '@/server/books/repository';
import * as reservationsRepository from '@/server/reservations/repository';
import * as reviewsRepository from '@/server/reviews/repository';
import * as repository from '@/server/members/repository';
import type { ReadingProfileOut } from '@/server/members/schemas';

// Mirrors backend/src/app/modules/members/reading_profile.py. Personal AI Reading
// Profile: aggregates a member's loans/reviews/reservations into compact category/
// author/rating counts (never raw history), sends just that summary to the configured
// LLM, and caches it on the User row. Regenerated only when the member's total activity
// count has grown since the cached version was made — mirrors Book.reviewDigest/
// reviewDigestReviewCount's staleness-by-count pattern, so a profile page visit is a
// pure cache hit unless something new happened.
//
// Also reuses Book.aiInsights (books/insights.ts) for a difficulty signal instead of a
// second AI call — see the "recently borrowed" difficulty tally below.

const DIFFICULTY_VALUES = new Set(['Beginner', 'Intermediate', 'Advanced', 'Unknown']);
const PREFERENCE_VALUES = new Set(['Practical', 'Theoretical', 'Mixed', 'Unknown']);
const TOP_INTERESTS = 3;

const SYSTEM_PROMPT = `You are a library assistant that writes a short reading profile for
a member, given a compact summary of their borrowing/review/reservation activity (never
their full history — just aggregate counts). Output ONLY a JSON object with exactly
these keys:
- interests: up to 3 short category/topic names, most-engaged first
- difficulty: one of "Beginner", "Intermediate", "Advanced", "Unknown"
- preference: one of "Practical", "Theoretical", "Mixed", "Unknown"
- insight: one short sentence describing their reading habits

Base every field only on the data given below. If the data is too sparse to judge a
field, use "Unknown" rather than guessing. Output nothing but the JSON object: no
explanation, no markdown formatting, no reasoning.`;

function cleanInterests(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const cleaned = value
    .filter((item) => typeof item === 'string' || typeof item === 'number')
    .map((item) => String(item).trim());
  return cleaned.filter((item) => item.length > 0).slice(0, TOP_INTERESTS);
}

function cleanEnum(value: unknown, allowed: Set<string>): string {
  return typeof value === 'string' && allowed.has(value) ? value : 'Unknown';
}

function normalize(parsed: Record<string, unknown>): ReadingProfileOut {
  const insight = parsed.insight;
  return {
    interests: cleanInterests(parsed.interests),
    difficulty: cleanEnum(parsed.difficulty, DIFFICULTY_VALUES),
    preference: cleanEnum(parsed.preference, PREFERENCE_VALUES),
    insight: typeof insight === 'string' && insight.trim() ? insight.trim() : 'Unknown',
  };
}

// Returns [totalActivityCount, compactPromptText]. totalActivityCount is what gets
// cached alongside the profile to detect when regeneration is actually needed — the
// prompt text itself is aggregate counts only, never a per-item history dump.
async function activitySignal(memberId: string): Promise<[number, string]> {
  const loans = await booksRepository.listLoansForMember(memberId);
  const reviews = await reviewsRepository.listForMember(memberId);
  const reservations = await reservationsRepository.listForMember(memberId);

  const categoryCounts = new Map<string, number>();
  const authorCounts = new Map<string, number>();
  const difficultyCounts = new Map<string, number>();

  const bump = (map: Map<string, number>, key: string, by = 1) => map.set(key, (map.get(key) ?? 0) + by);

  for (const loan of loans) {
    bump(categoryCounts, loan.book.category);
    bump(authorCounts, loan.book.author);
    const insights = loan.book.aiInsights as { difficulty?: unknown } | null;
    const difficulty = insights && typeof insights === 'object' ? insights.difficulty : null;
    if (typeof difficulty === 'string' && difficulty !== 'Unknown') bump(difficultyCounts, difficulty);
  }
  for (const review of reviews) bump(categoryCounts, review.book.category);
  for (const reservation of reservations) bump(categoryCounts, reservation.book.category);

  const ratings = reviews.map((r) => r.rating);
  const avgRating = ratings.length > 0 ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : null;

  const topN = (map: Map<string, number>, n: number) =>
    [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);

  const topCategories = topN(categoryCounts, 5).map(([c, n]) => `${c} (${n})`).join(', ') || 'none';
  const topAuthors = topN(authorCounts, 3).map(([a, n]) => `${a} (${n})`).join(', ') || 'none';
  const difficultyLine =
    topN(difficultyCounts, difficultyCounts.size).map(([d, n]) => `${d} (${n})`).join(', ') || 'unknown';

  const text =
    `Books borrowed: ${loans.length}\n` +
    `Reviews written: ${reviews.length} (average rating given: ${avgRating ?? 'n/a'})\n` +
    `Reservations made: ${reservations.length}\n` +
    `Top categories engaged with: ${topCategories}\n` +
    `Top authors borrowed: ${topAuthors}\n` +
    `Difficulty of recently borrowed books (from cached AI analysis): ${difficultyLine}`;

  return [loans.length + reviews.length + reservations.length, text];
}

// null means "nothing to profile yet" (zero activity) or "unavailable right now" (LLM
// call failed) with no prior cache to fall back on — the caller renders an unavailable
// state, never a fabricated profile. A transient LLM failure with an existing cached
// profile keeps returning that stale-but-real profile rather than blanking it out,
// matching "existing functionality continues working normally".
export async function ensureReadingProfile(user: {
  id: string;
  readingProfile: unknown;
  readingProfileActivityCount: number | null;
}): Promise<ReadingProfileOut | null> {
  const [activityCount, promptText] = await activitySignal(user.id);
  const cached = user.readingProfile as ReadingProfileOut | null;

  if (cached && user.readingProfileActivityCount === activityCount) return cached;
  if (activityCount === 0) return null;

  let parsed: Record<string, unknown> | null;
  try {
    const llm = await buildChatLlm();
    const result = await llm.invoke([new SystemMessage(SYSTEM_PROMPT), new HumanMessage(promptText)]);
    parsed = extractJsonObject(String(result.content));
  } catch (exc) {
    logLlmFailure('reading_profile', exc, { member_id: user.id });
    return cached;
  }

  if (parsed === null) {
    console.warn(`Reading profile response for member ${user.id} was not valid JSON`);
    return cached;
  }

  const data = normalize(parsed);
  await repository.updateMember(user.id, {
    readingProfile: data as unknown as Prisma.InputJsonValue,
    readingProfileActivityCount: activityCount,
  });
  return data;
}
