import { z } from 'zod';

// Mirrors backend/src/app/modules/translate/schemas.py.

export const translateRequestSchema = z.object({
  text: z.string().min(1).max(5000),
  target_lang: z.string().min(2).max(10),
  source_lang: z.string().default('auto'),
});
export type TranslateRequestInput = z.infer<typeof translateRequestSchema>;

export interface TranslateResponse {
  translated: string;
}

// Sized to fit one complete UI locale in a single request. en.json currently flattens to
// ~1600 strings / ~40k characters, and the old 100-item / 20k-character caps meant every
// auto-translated language 422'd on its first and only attempt — the whole feature was
// dead for the ten languages without a static locale file. Chunking on the client was the
// alternative, but ~16 requests collides with this endpoint's 10/minute limit, so the
// batch is what gives.
export const MAX_BATCH_ITEMS = 2500;
export const MAX_BATCH_CHARACTERS = 60_000;
export const MAX_TEXT_CHARACTERS = 5000;

export const translateBatchRequestSchema = z
  .object({
    texts: z.array(z.string()).min(1).max(MAX_BATCH_ITEMS),
    target_lang: z.string().min(2).max(10),
    source_lang: z.string().default('auto'),
  })
  .superRefine((data, ctx) => {
    if (data.texts.some((text) => !text || text.length > MAX_TEXT_CHARACTERS)) {
      ctx.addIssue({
        code: 'custom',
        message: `Each text must contain between 1 and ${MAX_TEXT_CHARACTERS} characters`,
      });
    }
    const total = data.texts.reduce((sum, text) => sum + text.length, 0);
    if (total > MAX_BATCH_CHARACTERS) {
      ctx.addIssue({
        code: 'custom',
        message: `Batch text is limited to ${MAX_BATCH_CHARACTERS} characters`,
      });
    }
  });
export type TranslateBatchRequestInput = z.infer<typeof translateBatchRequestSchema>;

export interface TranslateBatchResponse {
  translated: string[];
}
