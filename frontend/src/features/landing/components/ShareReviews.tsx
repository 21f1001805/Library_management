import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { Section, SectionHeading } from '@/components/common';
import { Badge, Button } from '@/components/ui';
import { ROUTES } from '@/constants/routes';

import { fadeUp, viewportOnce } from '../motion';
import { covers } from './PosterWall';

const FEATURED_COVER = covers[6];

const reactionPills = [
  {
    id: 'skipIt',
    colorClassName: 'bg-danger text-danger-foreground',
    positionClassName: '-left-2 -top-3 -rotate-6 sm:-left-6 sm:-top-4',
  },
  {
    id: 'goForIt',
    colorClassName: 'bg-success text-success-foreground',
    positionClassName: '-right-2 top-1/3 rotate-3 sm:-right-6',
  },
  {
    id: 'timepass',
    colorClassName: 'bg-warning text-warning-foreground',
    positionClassName: '-left-1 bottom-6 rotate-2 sm:-left-4',
  },
] as const;

export function ShareReviews() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <Section ariaLabelledBy="share-reviews-heading" tone="secondary">
      <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
        <motion.div initial="hidden" whileInView="visible" viewport={viewportOnce} variants={fadeUp}>
          <SectionHeading
            id="share-reviews-heading"
            title={t('landing.shareReviews.heading')}
            description={t('landing.shareReviews.subheading')}
            descriptionClassName="max-w-lg"
          />
          <div className="mt-8">
            <Button size="lg" onClick={() => navigate(ROUTES.REVIEWS)}>
              {t('reviews.writeReview')}
            </Button>
          </div>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeUp}
          transition={{ duration: 0.4, ease: 'easeOut', delay: 0.1 }}
          className="relative mx-auto w-full max-w-56"
        >
          <img
            src={FEATURED_COVER}
            alt={t('landing.shareReviews.imgAlt')}
            className="aspect-2/3 w-full rounded-2xl object-cover shadow-xl ring-1 ring-white/10"
          />
          {reactionPills.map((pill, index) => (
            <motion.span
              key={pill.id}
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={viewportOnce}
              transition={{ duration: 0.3, delay: 0.3 + index * 0.1 }}
              className={`absolute ${pill.positionClassName}`}
            >
              <Badge className={`px-4 py-1.5 text-sm shadow-lg ${pill.colorClassName}`}>
                {t(`landing.shareReviews.reactions.${pill.id}`)}
              </Badge>
            </motion.span>
          ))}
        </motion.div>
      </div>
    </Section>
  );
}
