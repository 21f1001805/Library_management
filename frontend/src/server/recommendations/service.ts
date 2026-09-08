import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import type { Book } from '@prisma/client';

import { buildChatLlm, extractJsonObject, logLlmFailure } from '@/server/llm';
import { bookToJson } from '@/server/books/schemas';
import * as booksRepository from '@/server/books/repository';
import * as membersRepository from '@/server/members/repository';
import * as repository from '@/server/recommendations/repository';
import * as scoring from '@/server/recommendations/scoring';
import {
  NO_PREFERENCE,
  type QuizAnswers,
  type QuizQuestion,
  type QuizResponse,
  type RecommendationResponse,
} from '@/server/recommendations/schemas';

// Mirrors backend/src/app/modules/recommendations/service.py in full.

// Thresholds for whether a dimension is worth asking about at all. Deliberately low —
// these gate "does this attribute meaningfully differentiate the catalog", not "is this a
// statistically robust sample". A 401-book catalog trivially clears all of them for
// author/era; they mostly matter for tests exercising a small/skewed seeded catalog.
const MIN_BOOKS_PER_AUTHOR_OPTION = 5;
const MAX_AUTHOR_OPTIONS = 6;
const MIN_ERA_BUCKET_BOOKS = 5;
const MIN_QUALIFYING_ERA_BUCKETS = 2;
const MIN_DESCRIBED_BOOKS_FOR_STORY_TYPE = 10;
const MIN_GROUP_SIZE_FOR_POPULARITY = 5;

const MIN_RESULTS = 5;
const MAX_RESULTS = 6;

const ERA_LABELS: Record<string, string> = {
  pre_1950: 'Timeless classics (before 1950)',
  '1950_1989': 'Retro favorites (1950s-80s)',
  '1990_2009': 'Modern era (1990s-2000s)',
  '2010_plus': 'Fresh releases (2010 onward)',
};
const POPULARITY_OPTIONS: Record<string, string> = {
  trending: "What's trending with other members",
  hidden_gems: 'Hidden gems',
};

const SURPRISE_ME = { id: NO_PREFERENCE, label: 'Surprise me' };

async function validAuthors(): Promise<string[]> {
  const rows = await repository.countBooksByAuthor(MIN_BOOKS_PER_AUTHOR_OPTION, MAX_AUTHOR_OPTIONS);
  return rows.map(([name]) => name);
}

async function validEras(): Promise<string[]> {
  const counts = await repository.countBooksByEra();
  return Object.keys(ERA_LABELS).filter((key) => (counts[key] ?? 0) >= MIN_ERA_BUCKET_BOOKS);
}

// Every question and option is computed live from the current catalog, so the quiz
// adapts automatically as books are added, removed, borrowed, or reviewed. A field with
// no meaningful diversity simply never produces a question — see the thresholds above.
export async function buildQuiz(): Promise<QuizResponse> {
  const questions: QuizQuestion[] = [];

  const authors = await validAuthors();
  if (authors.length > 0) {
    questions.push({
      id: 'author',
      prompt: "Any author whose books you'd like more of?",
      options: [...authors.map((name) => ({ id: name, label: name })), SURPRISE_ME],
    });
  }

  const eras = await validEras();
  if (eras.length >= MIN_QUALIFYING_ERA_BUCKETS) {
    questions.push({
      id: 'era',
      prompt: 'How old-school do you like your reads?',
      options: [...eras.map((key) => ({ id: key, label: ERA_LABELS[key] })), SURPRISE_ME],
    });
  }

  const described = await repository.countDescribedBooks();
  if (described >= MIN_DESCRIBED_BOOKS_FOR_STORY_TYPE) {
    questions.push({
      id: 'story_type',
      prompt: 'What kind of story pulls you in right now?',
      options: [
        ...scoring.STORY_TYPES.map(([key, label]) => ({ id: key, label })),
        SURPRISE_ME,
      ],
    });
  }

  const [borrowed, neverBorrowed] = await repository.countLoanedBooks();
  const hasBorrowedGroup = borrowed >= MIN_GROUP_SIZE_FOR_POPULARITY;
  const hasUnborrowedGroup = neverBorrowed >= MIN_GROUP_SIZE_FOR_POPULARITY;
  if (hasBorrowedGroup && hasUnborrowedGroup) {
    questions.push({
      id: 'popularity',
      prompt: 'Do you want proven favorites or something undiscovered?',
      options: [
        ...Object.entries(POPULARITY_OPTIONS).map(([key, label]) => ({ id: key, label })),
        SURPRISE_ME,
      ],
    });
  }

  return { questions };
}

// Re-validates every answer against a freshly recomputed valid-value set. A value that
// isn't currently valid (stale, tampered, or simply never real) is treated as "no
// preference" rather than trusted or erroring the whole request — the backend decides
// what's real, never the client.
async function normalizeAnswers(raw: QuizAnswers): Promise<QuizAnswers> {
  const validAuthorSet = new Set(await validAuthors());
  const validEraSet = new Set(await validEras());

  function clean(
    value: string | string[] | null | undefined,
    valid: Set<string> | null = null,
  ): string | string[] | null {
    if (!value || (Array.isArray(value) && value.length === 0)) return null;
    const items = typeof value === 'string' ? [value] : value;
    const cleaned = items.filter((item) => item && item !== NO_PREFERENCE && (valid === null || valid.has(item)));
    if (cleaned.length === 0) return null;
    return cleaned.length === 1 ? cleaned[0] : cleaned;
  }

  return {
    author: clean(raw.author, validAuthorSet),
    era: clean(raw.era, validEraSet),
    story_type: clean(raw.story_type, new Set(Object.keys(scoring.STORY_TYPE_KEYWORDS))),
    popularity: clean(raw.popularity, new Set(Object.keys(POPULARITY_OPTIONS))),
  };
}

// Tries the strictest filter combination the member actually specified, then
// progressively drops the weaker of the two hard-filterable fields (era before author —
// an author pick is a more specific signal than a 20-40 year window) down to the whole
// catalog. Returns [candidates, relaxed] where `relaxed` is true iff we had to go looser
// than the member's own strictest stated preference to find enough matches.
// Already-borrowed books never appear — recommending something the member has already
// read isn't a matter of taste, it's a miss, at every relaxation stage alike.
async function fetchCandidates(
  answers: QuizAnswers,
  excludeIds: Set<string>,
): Promise<[Book[], boolean]> {
  const levels: { author?: string | string[]; era?: string | string[] }[] = [];
  if (answers.author && answers.era) levels.push({ author: answers.author, era: answers.era });
  if (answers.author) levels.push({ author: answers.author });
  else if (answers.era) levels.push({ era: answers.era });
  levels.push({});

  for (let index = 0; index < levels.length; index += 1) {
    const candidates = await repository.findCandidates({ ...levels[index], excludeIds });
    if (candidates.length >= MIN_RESULTS || index === levels.length - 1) {
      return [candidates, index > 0];
    }
  }
  return [[], true]; // unreachable — `levels` always ends in {}
}

function ratingsByBook(reviews: { bookId: string; rating: number }[]): Map<string, [number, number]> {
  const grouped = new Map<string, number[]>();
  for (const review of reviews) {
    const list = grouped.get(review.bookId) ?? [];
    list.push(review.rating);
    grouped.set(review.bookId, list);
  }
  const result = new Map<string, [number, number]>();
  for (const [bookId, values] of grouped) {
    const average = Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
    result.set(bookId, [average, values.length]);
  }
  return result;
}

// One query serving two purposes: which books to exclude (already borrowed) and which
// authors to bonus-score (borrowed more than once).
async function memberLoanContext(memberId: string): Promise<[Set<string>, Map<string, number>]> {
  const loans = await booksRepository.listLoansForMember(memberId);
  const borrowedIds = new Set(loans.map((loan) => loan.bookId));
  const authorCounts = new Map<string, number>();
  for (const loan of loans) {
    authorCounts.set(loan.book.author, (authorCounts.get(loan.book.author) ?? 0) + 1);
  }
  return [borrowedIds, authorCounts];
}

// Reads whatever AI reading profile (members/readingProfile) is already cached — never
// triggers a fresh generation from inside the quiz flow, so submitting the quiz never
// causes an extra LLM call. Empty if the member has no profile yet.
async function profileInterests(memberId: string): Promise<Set<string>> {
  const user = await membersRepository.findById(memberId);
  const profile = user?.readingProfile as { interests?: unknown } | null | undefined;
  const interests = profile && typeof profile === 'object' ? profile.interests : null;
  return new Set(Array.isArray(interests) ? (interests as string[]) : []);
}

export async function submitQuiz(memberId: string, rawAnswers: QuizAnswers): Promise<RecommendationResponse> {
  const answers = await normalizeAnswers(rawAnswers);
  const [borrowedIds, historyAuthors] = await memberLoanContext(memberId);
  const interests = await profileInterests(memberId);
  const [candidates, relaxed] = await fetchCandidates(answers, borrowedIds);

  if (candidates.length === 0) {
    return {
      items: [],
      relaxed: true,
      message: "There aren't enough books in the library to create recommendations yet.",
    };
  }

  const bookIds = candidates.map((book) => book.id);
  const reviews = await repository.listReviewsForBooks(bookIds);
  const ratings = ratingsByBook(reviews);
  const loanCounts = await repository.countLoansForBooks(bookIds);

  const scored = scoring.scoreCandidates(candidates, answers, {
    ratings,
    loanCounts,
    historyAuthors,
    profileInterests: interests,
  });

  // Defensive: the query shape here can't currently produce duplicate rows, but a result
  // list is a promise worth keeping cheaply even if that changes later.
  const seen = new Set<string>();
  const top: typeof scored = [];
  for (const candidate of scored) {
    if (seen.has(candidate.book.id)) continue;
    seen.add(candidate.book.id);
    top.push(candidate);
    if (top.length === MAX_RESULTS) break;
  }

  const bookOut = (book: Book) => {
    const [averageRating, reviewCount] = ratings.get(book.id) ?? [null, 0];
    return bookToJson(book, { averageRating, reviewCount });
  };

  const items = top.map((sb) => ({
    book: bookOut(sb.book),
    score: sb.score,
    reasons: sb.reasons.length > 0 ? sb.reasons : ['From our library catalog'],
  }));

  let message: string;
  if (top.length < MIN_RESULTS) {
    message = 'We found the closest matches from the books currently available in our library.';
  } else if (relaxed) {
    message = 'We expanded your search to find more great matches from our library.';
  } else {
    message = "Here's what we found based on your preferences.";
  }

  return { items, relaxed, message };
}

// ── "Describe it, don't quiz it" ─────────────────────────────────────────────
// The LLM's only job below is mapping free text onto the same QuizAnswers shape the quiz
// UI already produces — it never sees or ranks a single book. submitQuiz (the untouched,
// deterministic scoring engine above) does the actual work either way, so a parsing
// failure here degrades to "no preference" answers, never an error.

function describePrompt(
  authors: string[],
  eras: [string, string][],
  storyTypes: [string, string][],
  popularity: [string, string][],
): string {
  const authorLine = authors.length > 0 ? authors.join(', ') : '(none available)';
  const eraLines = eras.length > 0 ? eras.map(([key, label]) => `  ${key} = ${label}`).join('\n') : '  (none available)';
  const storyLines = storyTypes.map(([key, label]) => `  ${key} = ${label}`).join('\n');
  const popularityLines = popularity.map(([key, label]) => `  ${key} = ${label}`).join('\n');
  return `You turn a library member's free-text book request into structured filters for a
recommendation engine. Output ONLY a JSON object with exactly these keys: author, era,
story_type, popularity. Each value must be one of the listed valid ids for that field
(copy the id itself, not its meaning) — or null if the description doesn't clearly
indicate a preference for that field. Never invent a value that isn't listed below.
Output nothing but the JSON object: no explanation, no markdown formatting.

Valid authors: ${authorLine}

Valid eras (id = meaning):
${eraLines}

Valid story types (id = meaning):
${storyLines}

Valid popularity (id = meaning):
${popularityLines}`;
}

async function parseDescription(description: string): Promise<QuizAnswers> {
  const authors = await validAuthors();
  const eras: [string, string][] = (await validEras()).map((key) => [key, ERA_LABELS[key]]);
  const storyTypes: [string, string][] = scoring.STORY_TYPES.map(([key, label]) => [key, label]);
  const popularity = Object.entries(POPULARITY_OPTIONS) as [string, string][];

  let parsed: Record<string, unknown> | null = null;
  try {
    const llm = await buildChatLlm();
    const result = await llm.invoke([
      new SystemMessage(describePrompt(authors, eras, storyTypes, popularity)),
      new HumanMessage(description),
    ]);
    parsed = extractJsonObject(String(result.content));
  } catch (exc) {
    logLlmFailure('describe_to_quiz', exc, { description: description.slice(0, 120) });
  }

  if (parsed === null) return {};
  const fields = parsed;

  const get = (key: string): string | null => {
    const value = fields[key];
    return typeof value === 'string' ? value : null;
  };

  return {
    author: get('author'),
    era: get('era'),
    story_type: get('story_type'),
    popularity: get('popularity'),
  };
}

export async function describeAndRecommend(memberId: string, description: string): Promise<RecommendationResponse> {
  // normalizeAnswers (inside submitQuiz) re-validates every field against a fresh
  // valid-value set regardless — the LLM's output is never trusted further than the quiz
  // UI's own answers are.
  const answers = await parseDescription(description);
  return submitQuiz(memberId, answers);
}
