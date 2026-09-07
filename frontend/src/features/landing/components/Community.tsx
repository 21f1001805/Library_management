'use client';

import { ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import { IconBadge, Section, SectionHeading } from '@/components/common';
import { Card } from '@/components/ui';
import { cn } from '@/lib/cn';
import {
  achievements,
  communityHighlights,
  readingChallengeStats,
  readingChallengeSteps,
} from '@/mocks/landing';

import { fadeUp, viewportOnce } from '../motion';

// Served straight from public/ (moved out of src/assets, a Vite-only typed-import
// convention) so both the Vite app and the Next.js app can reference it by plain URL.
const communityIllustration = '/community.png';

export function Community() {
  const { t } = useTranslation();

  return (
    <Section ariaLabelledBy="community-heading">
      <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeUp}
        >
          <SectionHeading
            id="community-heading"
            title={t('landing.community.heading')}
            highlight={t('landing.community.headingHighlight')}
            description={t('landing.community.subheading')}
            descriptionClassName="max-w-lg"
          />

          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {communityHighlights.map((item) => {
              const title = t(`landing.community.items.${item.id}.title`);
              return (
                <motion.div
                  key={item.id}
                  initial="hidden"
                  whileInView="visible"
                  viewport={viewportOnce}
                  variants={fadeUp}
                >
                  <Card className="flex h-full flex-col gap-3 p-5">
                    <IconBadge icon={item.icon} tone={item.tone} size={11} />
                    <div>
                      <p className="font-semibold text-foreground">{title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {t(`landing.community.items.${item.id}.description`)}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label={t('landing.community.exploreAria', { title })}
                      className="mt-auto flex size-8 items-center justify-center rounded-full bg-secondary text-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
                    >
                      <ArrowRight className="size-4" />
                    </button>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeUp}
          transition={{ duration: 0.4, ease: 'easeOut', delay: 0.1 }}
        >
          <img
            src={communityIllustration}
            alt={t('landing.community.imgAlt')}
            className="w-full object-contain"
          />
        </motion.div>
      </div>

      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={viewportOnce}
        variants={fadeUp}
        transition={{ duration: 0.4, ease: 'easeOut', delay: 0.15 }}
      >
        <Card className="mt-10 grid gap-6 p-6 lg:grid-cols-3 lg:items-center lg:gap-8">
          <div>
            <p className="text-lg font-semibold text-foreground">
              {t('landing.readingChallenge.heading')}{' '}
              <span className="text-primary">{t('landing.readingChallenge.highlight')}</span>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('landing.readingChallenge.subheading')}
            </p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {achievements.map((achievement) => (
                <li key={achievement.id}>
                  <span
                    title={t(`landing.readingChallenge.achievements.${achievement.id}.description`)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium',
                      achievement.colorClass,
                    )}
                  >
                    <achievement.icon className="size-3.5" />
                    {t(`landing.readingChallenge.achievements.${achievement.id}.label`)}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid grid-cols-1 gap-4 py-2 sm:grid-cols-3 lg:border-x lg:border-border lg:px-8 lg:py-0">
            {readingChallengeSteps.map((step) => (
              <div key={step.id} className="flex items-center gap-3 lg:flex-col lg:items-start">
                <IconBadge icon={step.icon} tone="primary-tint" />
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {t(`landing.readingChallenge.steps.${step.id}.title`)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t(`landing.readingChallenge.steps.${step.id}.description`)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-5">
            {readingChallengeStats.map((stat) => (
              <div key={stat.id} className="flex items-center gap-3">
                <IconBadge icon={stat.icon} size={10} />
                <div>
                  <p className="text-2xl font-bold leading-none text-foreground md:text-3xl">
                    {stat.value}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t(`landing.readingChallenge.stats.${stat.id}`)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </motion.div>
    </Section>
  );
}
