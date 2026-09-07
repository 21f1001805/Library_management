'use client';

import { useTranslation } from 'react-i18next';

import { Section } from '@/components/common';

import { ContainerScroll } from './ContainerScroll';

// Served straight from public/ (moved out of src/assets, a Vite-only typed-import
// convention) so both the Vite app and the Next.js app can reference it by plain URL.
const platformPreview = '/platform-preview.png';

export function PlatformPreview() {
  const { t } = useTranslation();

  return (
    <Section ariaLabelledBy="platform-preview-heading" containerClassName="max-w-7xl">
      <ContainerScroll
        titleComponent={
          <h2
            id="platform-preview-heading"
            className="text-3xl font-semibold text-foreground md:text-4xl"
          >
            {t('landing.preview.title')}
          </h2>
        }
      >
        <img
          src={platformPreview}
          alt={t('landing.preview.imgAlt')}
          className="mx-auto aspect-1635/962 w-full rounded-2xl object-cover"
          draggable={false}
        />
      </ContainerScroll>
    </Section>
  );
}
