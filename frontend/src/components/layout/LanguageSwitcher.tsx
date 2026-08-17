import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { LANGUAGES } from '@/i18n/languages';
import { cn } from '@/lib/cn';
import { useLanguage } from '@/providers/LanguageProvider';

export interface LanguageSwitcherProps {
  className?: string;
}

export function LanguageSwitcher({ className }: LanguageSwitcherProps) {
  const { t } = useTranslation();
  const { language, setLanguage, isTranslating } = useLanguage();

  return (
    <label className={cn('inline-flex items-center gap-1.5 text-xs', className)}>
      <span className="sr-only">{t('language.label')}</span>
      {isTranslating && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
      <select
        value={language}
        onChange={(event) => setLanguage(event.target.value)}
        disabled={isTranslating}
        aria-label={t('language.label')}
        aria-busy={isTranslating}
        className="cursor-pointer rounded-md border-none bg-transparent text-inherit outline-none [color-scheme:auto] disabled:cursor-wait disabled:opacity-70"
      >
        {LANGUAGES.map((option) => (
          <option key={option.code} value={option.code} className="text-foreground">
            {option.nativeName}
          </option>
        ))}
      </select>
    </label>
  );
}
