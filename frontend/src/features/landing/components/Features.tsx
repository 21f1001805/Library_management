import { motion } from 'framer-motion';
import { BookMarked, BookOpen, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { FeatureCard, Section, SectionHeading } from '@/components/common';
import { features } from '@/mocks/landing';

import { fadeUp, viewportOnce } from '../motion';
import { covers } from './PosterWall';

// Three real covers in a tilted cluster (bottom-left, top, bottom-right) — mirrors the
// illustration slot's old aspect without needing a bespoke image asset.
const [coverBottomLeft, coverTop, coverBottomRight] = [covers[2], covers[9], covers[16]];

function BookCoverStack() {
  return (
    <div aria-hidden className="relative mx-auto h-105 w-full max-w-md sm:h-120">
      <img
        src={coverBottomLeft}
        alt=""
        loading="lazy"
        className="absolute bottom-0 left-0 aspect-2/3 w-[42%] -rotate-6 rounded-2xl object-cover shadow-2xl ring-1 ring-white/10"
      />
      <div className="absolute bottom-4 left-[8%] z-20 flex size-14 items-center justify-center rounded-full bg-linear-to-br from-fuchsia-500 via-purple-500 to-indigo-500 shadow-lg ring-4 ring-background">
        <Sparkles className="size-6 text-white" />
      </div>

      <img
        src={coverTop}
        alt=""
        loading="lazy"
        className="absolute left-[22%] top-0 z-10 aspect-2/3 w-[46%] rotate-2 rounded-2xl object-cover shadow-2xl ring-1 ring-white/10"
      />
      <div className="absolute left-[14%] top-8 z-20 flex size-12 items-center justify-center rounded-full bg-neutral-900 shadow-lg ring-4 ring-background">
        <BookMarked className="size-5 text-white" />
      </div>

      <img
        src={coverBottomRight}
        alt=""
        loading="lazy"
        className="absolute bottom-8 right-0 z-30 aspect-2/3 w-[44%] -rotate-3 rounded-2xl object-cover shadow-2xl ring-1 ring-white/10"
      />
      <div className="absolute -top-2 right-[6%] z-40 flex size-14 items-center justify-center rounded-full bg-sky-500 shadow-lg ring-4 ring-background">
        <BookOpen className="size-6 text-white" />
      </div>
    </div>
  );
}

export function Features() {
  const { t } = useTranslation();

  return (
    <Section ariaLabelledBy="features-heading" tone="secondary">
      <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
        <motion.div initial="hidden" whileInView="visible" viewport={viewportOnce} variants={fadeUp}>
          <SectionHeading
            id="features-heading"
            headingClassName="text-4xl font-extrabold tracking-tight sm:text-5xl"
            title={
              <>
                {t('landing.features.headingPrefix')}{' '}
                <span className="text-primary">{t('landing.features.headingHighlight')}</span>{' '}
                {t('landing.features.headingSuffix')}
              </>
            }
            description={t('landing.features.subheading')}
            descriptionClassName="max-w-lg"
          />
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeUp}
          transition={{ duration: 0.4, ease: 'easeOut', delay: 0.1 }}
        >
          <BookCoverStack />
        </motion.div>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {features.map((feature) => (
          <motion.div
            key={feature.id}
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            variants={fadeUp}
            whileHover={{ y: -2 }}
          >
            <FeatureCard
              icon={feature.icon}
              title={t(`landing.features.items.${feature.id}.title`)}
              description={t(`landing.features.items.${feature.id}.description`)}
            />
          </motion.div>
        ))}
      </div>
    </Section>
  );
}
