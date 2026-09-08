import { createHash } from 'node:crypto';

import { HttpError } from '@/server/http';
import type {
  TranslateBatchRequestInput,
  TranslateBatchResponse,
  TranslateRequestInput,
  TranslateResponse,
} from '@/server/translate/schemas';

// Mirrors backend/src/app/modules/translate/service.py in full. The Python version
// shells out to deep_translator's GoogleTranslator, which itself just scrapes Google
// Translate's free unofficial endpoint — ported here as a direct fetch against that same
// endpoint (client=gtx) rather than pulling in a scraping package on the Node side.

// Caps how many translate calls run at once so we don't hammer Google's free endpoint
// (which has no official rate limit guarantee) when a batch is large.
const BATCH_CONCURRENCY = 16;

// In-memory cache so a given (source, target, text-list) batch — e.g. the full UI string
// set for one language — is only ever translated once per process lifetime, no matter how
// many users trigger it.
//
// Bounded: the key is a hash of caller-supplied text on an unauthenticated endpoint, so an
// unbounded map would grow by every distinct payload and never be reclaimed. Insertion
// order gives FIFO eviction for free — the real workload is a handful of full-locale
// batches, so tracking recency would cost more than it saves.
const BATCH_CACHE_MAX_ENTRIES = 64;
const batchCache = new Map<string, string[]>();

class LanguageNotSupportedError extends Error {}
class ProviderError extends Error {}

// Google Translate's supported source/target codes — validated up front so a bad code is
// a 400, not a 502 after a wasted network round trip (mirrors deep_translator raising
// LanguageNotSupportedException before ever hitting the network).
const SUPPORTED_LANGUAGES = new Set([
  'auto', 'af', 'sq', 'am', 'ar', 'hy', 'as', 'ay', 'az', 'bm', 'eu', 'be', 'bn', 'bho', 'bs', 'bg',
  'ca', 'ceb', 'ny', 'zh-cn', 'zh-tw', 'co', 'hr', 'cs', 'da', 'dv', 'doi', 'nl', 'en', 'eo', 'et',
  'ee', 'fil', 'fi', 'fr', 'fy', 'gl', 'ka', 'de', 'el', 'gn', 'gu', 'ht', 'ha', 'haw', 'he', 'iw',
  'hi', 'hmn', 'hu', 'is', 'ig', 'ilo', 'id', 'ga', 'it', 'ja', 'jv', 'jw', 'kn', 'kk', 'km', 'rw',
  'gom', 'ko', 'kri', 'ku', 'ckb', 'ky', 'lo', 'la', 'lv', 'ln', 'lt', 'lg', 'lb', 'mk', 'mai', 'mg',
  'ms', 'ml', 'mt', 'mi', 'mr', 'mni-mtei', 'lus', 'mn', 'my', 'ne', 'no', 'or', 'om', 'ps', 'fa',
  'pl', 'pt', 'pa', 'qu', 'ro', 'ru', 'sm', 'sa', 'gd', 'nso', 'sr', 'st', 'sn', 'sd', 'si', 'sk',
  'sl', 'so', 'es', 'su', 'sw', 'sv', 'tl', 'tg', 'ta', 'tt', 'te', 'th', 'ti', 'ts', 'tr', 'tk',
  'ak', 'uk', 'ur', 'ug', 'uz', 'vi', 'cy', 'xh', 'yi', 'yo', 'zu',
]);

function assertSupported(lang: string): void {
  if (!SUPPORTED_LANGUAGES.has(lang.toLowerCase())) {
    throw new LanguageNotSupportedError(`'${lang}' is not a supported language`);
  }
}

// Google's stock copy for "something broke on our end", served with a 200 status on the
// scrape endpoint (rate-limited/blocked requests, mostly) — caught here the same way
// deep_translator's caller has to, since a 200 with this text isn't a real translation.
const PROVIDER_ERROR_MARKERS = ["that's an error", "that's all we know", 'error 500 (server error)'];

async function translateOne(text: string, sourceLang: string, targetLang: string): Promise<string> {
  const params = new URLSearchParams({ client: 'gtx', sl: sourceLang, tl: targetLang, dt: 't', q: text });
  let response: Response;
  try {
    response = await fetch(`https://translate.googleapis.com/translate_a/single?${params}`, {
      signal: AbortSignal.timeout(15000),
    });
  } catch (exc) {
    throw new ProviderError(String(exc));
  }
  if (!response.ok) throw new ProviderError(`Google Translate returned ${response.status}`);

  const body = (await response.json().catch(() => null)) as unknown;
  const segments = Array.isArray(body) ? (body[0] as unknown) : null;
  if (!Array.isArray(segments)) throw new ProviderError('Unexpected translate response shape');
  const result = segments
    .map((segment) => (Array.isArray(segment) && typeof segment[0] === 'string' ? segment[0] : ''))
    .join('');

  const lowered = result.toLowerCase();
  if (PROVIDER_ERROR_MARKERS.some((marker) => lowered.includes(marker))) {
    throw new ProviderError(result);
  }
  return result;
}

export async function translateText(payload: TranslateRequestInput): Promise<TranslateResponse> {
  try {
    assertSupported(payload.source_lang);
    assertSupported(payload.target_lang);
    const translated = await translateOne(payload.text, payload.source_lang, payload.target_lang);
    return { translated };
  } catch (exc) {
    if (exc instanceof LanguageNotSupportedError) throw new HttpError(400, exc.message);
    throw new HttpError(502, 'Translation service unavailable');
  }
}

function batchCacheKey(texts: string[], sourceLang: string, targetLang: string): string {
  const joined = texts.join('\x1f');
  return createHash('sha256').update(`${sourceLang}|${targetLang}|${joined}`).digest('hex');
}

// Runs `fn` over `items` with at most `limit` in flight at once, preserving input order in
// the result array — mirrors an asyncio.Semaphore-gated asyncio.gather: the first
// rejection propagates immediately, same as gather's default fail-fast behavior.
async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker(): Promise<void> {
    for (;;) {
      const index = next;
      next += 1;
      if (index >= items.length) return;
      results[index] = await fn(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

export async function translateBatch(payload: TranslateBatchRequestInput): Promise<TranslateBatchResponse> {
  const cacheKey = batchCacheKey(payload.texts, payload.source_lang, payload.target_lang);
  const cached = batchCache.get(cacheKey);
  if (cached) return { translated: cached };

  let translated: string[];
  try {
    assertSupported(payload.source_lang);
    assertSupported(payload.target_lang);
    translated = await mapWithConcurrency(payload.texts, BATCH_CONCURRENCY, async (text) => {
      if (!text.trim()) return text;
      return translateOne(text, payload.source_lang, payload.target_lang);
    });
  } catch (exc) {
    if (exc instanceof LanguageNotSupportedError) throw new HttpError(400, exc.message);
    throw new HttpError(502, 'Translation service unavailable');
  }

  if (batchCache.size >= BATCH_CACHE_MAX_ENTRIES) {
    const oldestKey = batchCache.keys().next().value;
    if (oldestKey !== undefined) batchCache.delete(oldestKey);
  }
  batchCache.set(cacheKey, translated);
  return { translated };
}
