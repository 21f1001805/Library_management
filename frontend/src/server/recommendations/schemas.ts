import { z } from 'zod';

import type { BookOut } from '@/server/books/schemas';

// Mirrors backend/src/app/modules/recommendations/schemas.py.
export type QuestionId = 'author' | 'era' | 'story_type' | 'popularity';

// Sent by every question as its last option. Answering with this (or omitting the
// question) is normalized to "no preference" server-side — see service.normalizeAnswers.
export const NO_PREFERENCE = 'no_preference';

export interface QuizOption {
  id: string;
  label: string;
}

export interface QuizQuestion {
  id: QuestionId;
  prompt: string;
  options: QuizOption[];
}

export interface QuizResponse {
  questions: QuizQuestion[];
}

const stringOrList = z
  .union([z.string(), z.array(z.string())])
  .nullable()
  .optional();

// Selected option id(s) per question, keyed by question id. Every value is re-validated
// against a freshly recomputed set of currently-valid options before it's ever used — see
// service.normalizeAnswers. Nothing here is trusted as-is.
export const quizAnswersSchema = z.object({
  author: stringOrList,
  era: stringOrList,
  story_type: stringOrList,
  popularity: stringOrList,
});
export type QuizAnswers = z.infer<typeof quizAnswersSchema>;

export interface RecommendationItem {
  book: BookOut;
  score: number;
  reasons: string[];
}

export interface RecommendationResponse {
  items: RecommendationItem[];
  relaxed: boolean;
  message: string;
}

// Free text in place of the quiz — see service.describeAndRecommend. The LLM only ever
// maps this onto QuizAnswers; it never sees or ranks a single book.
export const describeRequestSchema = z.object({
  description: z.string().min(1).max(500),
});
export type DescribeRequestInput = z.infer<typeof describeRequestSchema>;
