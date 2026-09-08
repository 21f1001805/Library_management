import type { Book } from '@prisma/client';

import { buildEmbeddings, logLlmFailure } from '@/server/llm';
import * as repository from '@/server/books/repository';

// Mirrors backend/src/app/modules/books/embeddings.py. Embedding-based book similarity
// for GET /books/{id}/related — each book's title/author/category/description is
// embedded once and cached on Book.embedding; ranking is plain cosine similarity over
// cached vectors, no vector-index infrastructure needed for a ~400-book catalog.

export function embeddingText(book: Book): string {
  const parts = [book.title, book.author, book.category];
  if (book.description) parts.push(book.description);
  return parts.join('\n');
}

// Returns the book's cached embedding, computing and persisting it first if missing.
// Failures are logged and swallowed — the caller treats an empty vector as "no signal
// for this book" and falls back gracefully rather than failing the whole related-books
// request over one bad embed call.
export async function ensureEmbedding(book: Book): Promise<number[]> {
  if (book.embedding && book.embedding.length > 0) return book.embedding;

  let vector: number[];
  try {
    const embeddings = await buildEmbeddings();
    vector = await embeddings.embedQuery(embeddingText(book));
  } catch (exc) {
    logLlmFailure('ensureEmbedding', exc, { book_id: book.id, title: book.title });
    return [];
  }

  await repository.saveEmbedding(book.id, vector);
  return vector;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0.0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);
  if (normA === 0 || normB === 0) return 0.0;
  return dot / (normA * normB);
}

// Highest-cosine-similarity-first, dropping any candidate with no usable embedding (an
// empty vector scores 0.0 via cosineSimilarity's guard, but excluding it outright keeps
// a same-scored coincidence from ever outranking a real embedded match).
export function rankBySimilarity(target: number[], candidates: Book[], limit: number): Book[] {
  const scored = candidates
    .filter((book) => book.embedding && book.embedding.length > 0)
    .map((book): [Book, number] => [book, cosineSimilarity(target, book.embedding)]);
  scored.sort((a, b) => b[1] - a[1]);
  return scored.slice(0, limit).map(([book]) => book);
}
