import { useState } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, Select } from '@/components/ui';
import { useTranslateText } from '@/features/translate/hooks/useTranslateText';
import { cn } from '@/lib/cn';

const DEMO_LANGUAGES = [
  { value: 'hi', label: 'Hindi (हिन्दी)' },
  { value: 'bn', label: 'Bengali (বাংলা)' },
  { value: 'ta', label: 'Tamil (தமிழ்)' },
  { value: 'te', label: 'Telugu (తెలుగు)' },
  { value: 'mr', label: 'Marathi (मराठी)' },
  { value: 'gu', label: 'Gujarati (ગુજરાતી)' },
  { value: 'kn', label: 'Kannada (ಕನ್ನಡ)' },
  { value: 'ml', label: 'Malayalam (മലയാളം)' },
  { value: 'pa', label: 'Punjabi (ਪੰਜਾਬੀ)' },
  { value: 'ur', label: 'Urdu (اردو)' },
  { value: 'or', label: 'Odia (ଓଡ଼ିଆ)' },
  { value: 'as', label: 'Assamese (অসমীয়া)' },
];

const DEFAULT_TEXT = 'Welcome to the library. This book is currently available to borrow.';

export function TranslateDemoPage() {
  const [text, setText] = useState(DEFAULT_TEXT);
  const [targetLang, setTargetLang] = useState('hi');
  const { translated, loading } = useTranslateText(text, targetLang);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-16">
      <Card className="rounded-3xl border-border bg-surface shadow-panel">
        <CardHeader>
          <CardTitle>Translation demo</CardTitle>
          <CardDescription>
            Type any text and pick a language — this calls the backend&apos;s free{' '}
            <code>deep-translator</code> proxy at <code>/api/translate</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="demo-source-text" className="text-sm font-medium text-foreground">
              Text to translate
            </label>
            <textarea
              id="demo-source-text"
              rows={4}
              value={text}
              onChange={(event) => setText(event.target.value)}
              className={cn(
                'w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground',
                'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
              )}
            />
          </div>

          <Select
            label="Translate to"
            options={DEMO_LANGUAGES}
            value={targetLang}
            onChange={(event) => setTargetLang(event.target.value)}
          />

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-foreground">
              Translated output {loading && <span className="text-muted-foreground">(translating…)</span>}
            </span>
            <p className="min-h-[3.5rem] rounded-md border border-border-muted bg-secondary/10 px-3 py-2 text-sm text-foreground">
              {translated}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
