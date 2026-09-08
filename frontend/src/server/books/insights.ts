import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import type { Book, Prisma } from '@prisma/client';

import { buildChatLlm, extractJsonObject, logLlmFailure } from '@/server/llm';
import * as repository from '@/server/books/repository';
import type { BookInsightsOut } from '@/server/books/schemas';

// Mirrors backend/src/app/modules/books/insights.py. One LLM call producing summary +
// key concepts + themes + difficulty + vocabulary complexity + prerequisites +
// why-read, all in one structured JSON response. Cached on Book.aiInsights so a page
// load never re-calls the model once generated; cleared by books/service.ts::updateBook
// whenever title/author/category/description change.

const DIFFICULTY_VALUES = new Set(['Beginner', 'Intermediate', 'Advanced', 'Unknown']);
const VOCAB_VALUES = new Set(['Low', 'Medium', 'High', 'Unknown']);
const DESCRIPTION_MAX_CHARS = 500;
const MAX_LIST_ITEMS = 5;

const SYSTEM_PROMPT = `You are a library cataloging assistant. Given a book's title, author,
category, and description, output ONLY a JSON object with exactly these keys:
- summary: 2-3 sentence plain-language summary
- key_concepts: 3-5 short phrases (key ideas/topics the book covers)
- themes: 2-3 short phrases (its main themes)
- difficulty: one of "Beginner", "Intermediate", "Advanced", "Unknown"
- technical_difficulty: one of "Beginner", "Intermediate", "Advanced", "Unknown" — use
  "Unknown" for fiction or books with no technical content
- vocabulary_complexity: one of "Low", "Medium", "High", "Unknown"
- prerequisites: 0-3 short phrases of prior knowledge helpful before reading (empty list
  if none)
- why_read: 1-2 sentences on why someone should read it

Base every field only on the text given below. If you cannot judge a field from that
text, use "Unknown" (or an empty list for a list field) rather than guessing. Output
nothing but the JSON object: no explanation, no markdown formatting, no reasoning.`;

function cleanStrList(value: unknown, maxItems = MAX_LIST_ITEMS): string[] {
  if (!Array.isArray(value)) return [];
  const cleaned = value
    .filter((item) => typeof item === 'string' || typeof item === 'number')
    .map((item) => String(item).trim());
  return cleaned.filter((item) => item.length > 0).slice(0, maxItems);
}

function cleanEnum(value: unknown, allowed: Set<string>): string {
  return typeof value === 'string' && allowed.has(value) ? value : 'Unknown';
}

function cleanText(value: unknown): string {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : 'Unknown';
}

function normalize(parsed: Record<string, unknown>): BookInsightsOut {
  return {
    summary: cleanText(parsed.summary),
    key_concepts: cleanStrList(parsed.key_concepts),
    themes: cleanStrList(parsed.themes, 3),
    difficulty: cleanEnum(parsed.difficulty, DIFFICULTY_VALUES),
    technical_difficulty: cleanEnum(parsed.technical_difficulty, DIFFICULTY_VALUES),
    vocabulary_complexity: cleanEnum(parsed.vocabulary_complexity, VOCAB_VALUES),
    prerequisites: cleanStrList(parsed.prerequisites, 3),
    why_read: cleanText(parsed.why_read),
  };
}

function bookPromptText(book: Book): string {
  const description = (book.description ?? '').slice(0, DESCRIPTION_MAX_CHARS);
  return (
    `Title: ${book.title}\nAuthor: ${book.author}\nCategory: ${book.category}\n` +
    `Description: ${description || '(none provided)'}`
  );
}

// Returns the book's cached AI insights, generating them first if missing. Returns null
// (never a fabricated result) if the call fails or the model's reply isn't parseable
// JSON — the caller renders an "AI unavailable" state rather than treating a missing
// result as an error, and nothing gets cached so a later retry can still succeed.
export async function ensureInsights(book: Book): Promise<BookInsightsOut | null> {
  if (book.aiInsights) return book.aiInsights as unknown as BookInsightsOut;

  let parsed: Record<string, unknown> | null;
  try {
    const llm = await buildChatLlm();
    const result = await llm.invoke([new SystemMessage(SYSTEM_PROMPT), new HumanMessage(bookPromptText(book))]);
    parsed = extractJsonObject(String(result.content));
  } catch (exc) {
    logLlmFailure('book_ai_insights', exc, { book_id: book.id, title: book.title });
    return null;
  }

  if (parsed === null) {
    console.warn(`AI insights response for book ${book.id} was not valid JSON`);
    return null;
  }

  const data = normalize(parsed);
  await repository.saveAiInsights(book.id, data as unknown as Prisma.InputJsonValue);
  return data;
}
