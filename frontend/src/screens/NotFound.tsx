'use client';

import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui';
import { ROUTES } from '@/constants/routes';

// Rendered inside the (public) route group's layout (see app/(public)/layout.tsx), so it
// inherits the site header/footer instead of building its own page shell.
export function NotFound() {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-4xl font-semibold text-foreground">{t('notFound.title')}</h1>
      <p className="text-muted-foreground">{t('notFound.message')}</p>
      <Button onClick={() => router.push(ROUTES.HOME)}>{t('notFound.backHome')}</Button>
    </div>
  );
}
