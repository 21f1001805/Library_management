import { prisma } from '@/server/db';
import { ensureEmbedding } from '@/server/books/embeddings';

// Mirrors backend/scripts/backfill_book_embeddings.py. Computes and caches the
// similarity embedding for every book that doesn't have one yet. `ensureEmbedding()`
// already computes embeddings lazily on first request (books/service.ts's
// getRelatedBooks), so this isn't required for correctness — it just means a fresh
// clone's first "You may also like" request doesn't wait on ~400 sequential embed
// calls. Safe to re-run: only books with an empty embedding are touched.

// A real provider outage (Ollama not running, no OpenAI key, etc.) fails fast and
// consistently — stop after a short run of consecutive failures instead of burning
// through the whole catalog making calls that will not succeed.
const MAX_CONSECUTIVE_FAILURES = 5;

export async function backfillBookEmbeddings(): Promise<string> {
  const books = await prisma.book.findMany({ where: { deletedAt: null } });
  const missing = books.filter((book) => !book.embedding || book.embedding.length === 0);
  if (missing.length === 0) {
    const line = `All ${books.length} books already have a cached embedding.`;
    console.log(line);
    return line;
  }

  let computed = 0;
  let consecutiveFailures = 0;
  for (const book of missing) {
    const vector = await ensureEmbedding(book);
    if (vector.length > 0) {
      computed += 1;
      consecutiveFailures = 0;
    } else {
      consecutiveFailures += 1;
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        const line =
          `Stopping after ${consecutiveFailures} consecutive failures — computed ` +
          `${computed}/${missing.length} before the embedding provider stopped responding. ` +
          'Check LLM_MODE and its credentials/model.';
        console.log(line);
        return line;
      }
    }
  }

  const line = `Computed embeddings for ${computed}/${missing.length} books missing one.`;
  console.log(line);
  return line;
}
