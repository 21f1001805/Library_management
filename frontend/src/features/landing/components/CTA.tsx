import { ArrowRight, MessageCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { AnimatedHeading, AnimatedText, Section } from '@/components/common';
import { Button } from '@/components/ui';
import { ROUTES } from '@/constants/routes';

import { fadeUp, viewportOnce } from '../motion';

export function CTA() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <Section
      ariaLabelledBy="cta-heading"
      tone="primary"
      size="3xl"
      className="relative overflow-hidden"
      containerClassName="relative flex flex-col items-center gap-6 text-center"
      decorative={
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute -right-20 -top-24 size-96 rounded-full bg-primary-foreground/10 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -left-16 bottom-0 size-72 rounded-full bg-primary-foreground/10 blur-3xl"
          />
        </>
      }
    >
      <AnimatedHeading id="cta-heading" color="inverted">
        {t('landing.cta.heading')}
      </AnimatedHeading>
      <AnimatedText tone="inverted" spacing={false} className="max-w-xl">
        {t('landing.cta.subheading')}
      </AnimatedText>
      <motion.div initial="hidden" whileInView="visible" viewport={viewportOnce} variants={fadeUp}>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button
            size="lg"
            variant="secondary"
            trailingIcon={<ArrowRight className="size-4" />}
            onClick={() => navigate(ROUTES.REGISTER)}
          >
            {t('landing.cta.button')}
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10"
            leadingIcon={<MessageCircle className="size-4" />}
            onClick={() => navigate(ROUTES.CONTACT_US)}
          >
            {t('landing.cta.contactUs')}
          </Button>
        </div>
      </motion.div>
    </Section>
  );
}
