import { useEffect, useState } from 'react';

import { apiPost } from '@/lib/api';

interface TranslateResponse {
  translated: string;
}

const DEBOUNCE_MS = 400;

/** Translates dynamic text (e.g. user-generated content) via the backend's free translate proxy. */
export function useTranslateText(text: string, targetLang: string) {
  const [translation, setTranslation] = useState<{
    text: string;
    targetLang: string;
    translated: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const skip = !text.trim() || targetLang === 'en';

  useEffect(() => {
    if (skip) return;

    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled) return;
      setLoading(true);
      apiPost<TranslateResponse>('/translate', { text, target_lang: targetLang })
        .then((data) => {
          if (!cancelled) setTranslation({ text, targetLang, translated: data.translated });
        })
        .catch(() => {
          if (!cancelled) setTranslation(null);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [text, targetLang, skip]);

  const translated =
    !skip && translation?.text === text && translation.targetLang === targetLang
      ? translation.translated
      : text;

  return { translated, loading: !skip && loading };
}

/** One-off translate call, e.g. for translating a batch of strings outside of render. */
export function translateText(text: string, targetLang: string): Promise<string> {
  return apiPost<TranslateResponse>('/translate', { text, target_lang: targetLang }).then(
    (data) => data.translated,
  );
}
