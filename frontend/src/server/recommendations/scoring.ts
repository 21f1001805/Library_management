import type { Book } from '@prisma/client';

import { NO_PREFERENCE, type QuizAnswers } from '@/server/recommendations/schemas';

// Mirrors backend/src/app/modules/recommendations/scoring.py in full. Pure scoring logic
// for the recommendation quiz — no Prisma, no I/O.
//
// The relaxation ladder (service.ts) only changes which candidates get *fetched* (the
// hard author/era filter). Scoring here always weighs every answer as a soft signal
// regardless of whether that same field is currently also a hard filter upstream — for a
// hard-filtered field every remaining candidate already matches it, so its bonus becomes
// a constant offset that doesn't change relative order. That keeps the original answers
// influencing the ranking at every relaxation level, per the "never discard preferences"
// rule, without the fetch and scoring layers needing to agree on which fields are
// "currently strict".

// Fixed content taxonomy for the "story type" question — not derived from a frequency
// count like author/era, since it's matched against free-text descriptions rather than a
// structured column.
export const STORY_TYPES: [string, string, string[]][] = [
  [
    'mystery_thriller',
    'Gripping mystery or thriller',
    ['mystery', 'murder', 'detective', 'thriller', 'suspense', 'crime', 'investigat'],
  ],
  [
    'heartwarming',
    'Heartwarming and reflective',
    ['family', 'friendship', 'heartwarming', 'self-discovery', 'warmth', 'relationship'],
  ],
  [
    'mythology_folklore',
    'Timeless mythology and folklore',
    ['mythology', 'folklore', 'fable', 'legend', 'ancient', 'gods', 'epic tale', 'retelling'],
  ],
  [
    'motivational',
    'Motivational and inspiring',
    ['motivat', 'self-help', 'inspir', 'success', 'growth', 'habit', 'mindset'],
  ],
  ['adventure', 'Epic and adventurous', ['adventure', 'quest', 'journey', 'battle', 'explore', 'war', 'epic']],
  ['humorous', 'Witty and humorous', ['humor', 'humour', 'witty', 'funny', 'comic', 'satire']],
];
export const STORY_TYPE_KEYWORDS: Record<string, string[]> = Object.fromEntries(
  STORY_TYPES.map(([key, , keywords]) => [key, keywords]),
);
const STORY_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  STORY_TYPES.map(([key, label]) => [key, label]),
);

const AUTHOR_MATCH_WEIGHT = 5;
const ERA_MATCH_WEIGHT = 4;
const STORY_TYPE_HIT_WEIGHT = 1;
const STORY_TYPE_MAX_HITS = 4;
const POPULARITY_WEIGHT = 2;
// Ambient, not a question — only 11% of the catalog has any review, too sparse a signal
// to dedicate a quiz question to. Any book with a strong average rating gets this
// automatically; the member never picks it.
const RATING_BOOST = 2;
const RATING_BOOST_THRESHOLD = 4.0;
// Between story type's max (+4) and popularity's (+2): being borrowable *today* is
// genuinely valuable to a "find my next book" feature, so it outweighs the softer
// behavioral signals, but a real content mismatch can still beat it — this is a scoring
// bonus, not a dominant sort tier, so a highly relevant unavailable book can still
// outrank a barely relevant available one.
const AVAILABILITY_WEIGHT = 3;
// Small on purpose — a returning member's borrowing history is a bonus signal, not
// something that should drown out what they told the quiz just now.
const HISTORY_AUTHOR_WEIGHT = 1;
// Same tier as HISTORY_AUTHOR_WEIGHT: the AI reading profile is another soft behavioral
// signal, not a replacement for what the member just told the quiz. profileInterests is
// optional and defaults to empty, so a member with no cached profile yet scores
// identically to before this existed.
const PROFILE_INTEREST_WEIGHT = 1;

function eraKeyForYear(year: number | null): string | null {
  if (year === null) return null;
  if (year < 1950) return 'pre_1950';
  if (year < 1990) return '1950_1989';
  if (year < 2010) return '1990_2009';
  return '2010_plus';
}

export interface ScoredBook {
  book: Book;
  score: number;
  reasons: string[];
}

function asList(value: string | string[] | null | undefined): string[] {
  if (value == null) return [];
  return typeof value === 'string' ? [value] : value;
}

export function scoreCandidates(
  books: Book[],
  answers: QuizAnswers,
  opts: {
    ratings: Map<string, [number, number]>;
    loanCounts: Map<string, number>;
    historyAuthors: Map<string, number>;
    profileInterests?: Set<string>;
  },
): ScoredBook[] {
  const { ratings, loanCounts, historyAuthors, profileInterests = new Set() } = opts;
  const scored: ScoredBook[] = [];

  for (const book of books) {
    let score = 0;
    const reasons: string[] = [];

    const authors = asList(answers.author);
    if (authors.includes(book.author) && book.author !== NO_PREFERENCE) {
      score += AUTHOR_MATCH_WEIGHT;
      reasons.push(`By ${book.author}, the author you picked`);
    }

    const eras = asList(answers.era);
    const bookEra = eraKeyForYear(book.publishedYear);
    if (bookEra && eras.includes(bookEra) && bookEra !== NO_PREFERENCE) {
      score += ERA_MATCH_WEIGHT;
      reasons.push('Matches the era you picked');
    }

    const storyTypes = asList(answers.story_type);
    if (book.description) {
      const text = book.description.toLowerCase();
      for (const st of storyTypes) {
        if (st === NO_PREFERENCE) continue;
        const keywords = STORY_TYPE_KEYWORDS[st] ?? [];
        const hits = Math.min(keywords.filter((kw) => text.includes(kw)).length, STORY_TYPE_MAX_HITS);
        if (hits) {
          score += hits * STORY_TYPE_HIT_WEIGHT;
          reasons.push(`Themes that fit ${STORY_TYPE_LABELS[st].toLowerCase()}`);
          break;
        }
      }
    }

    const pops = asList(answers.popularity);
    const loanCount = loanCounts.get(book.id) ?? 0;
    if (pops.includes('trending') && loanCount > 0) {
      score += POPULARITY_WEIGHT;
      reasons.push('Popular with other members');
    } else if (pops.includes('hidden_gems') && loanCount === 0) {
      score += POPULARITY_WEIGHT;
      reasons.push('A hidden gem — not widely borrowed yet');
    }

    const ratingEntry = ratings.get(book.id);
    const avgRating = ratingEntry ? ratingEntry[0] : null;
    if (avgRating !== null && avgRating >= RATING_BOOST_THRESHOLD) {
      score += RATING_BOOST;
      reasons.push(`Highly rated (${avgRating.toFixed(1)}★ from other readers)`);
    }

    if (book.totalCopies > 0) {
      score += AVAILABILITY_WEIGHT;
      reasons.push('Available to borrow right now');
    }

    const historyHits = historyAuthors.get(book.author) ?? 0;
    if (historyHits) {
      score += historyHits * HISTORY_AUTHOR_WEIGHT;
      reasons.push(`You've enjoyed other books by ${book.author}`);
    }

    if (profileInterests.has(book.category)) {
      score += PROFILE_INTEREST_WEIGHT;
      reasons.push("Matches your AI reading profile's interests");
    }

    scored.push({ book, score, reasons });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored;
}
