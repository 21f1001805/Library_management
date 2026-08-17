import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { ReviewCard, Section, SectionHeading } from '@/components/common';
import { testimonials } from '@/mocks/landing';
import { useActiveSection } from '@/providers/ActiveSectionProvider';

import { Marquee } from './Marquee';

const SECTION_ID = 'testimonials';

export function Testimonials() {
  const { t } = useTranslation();
  const { setActiveSection } = useActiveSection();

  // Marks "testimonials" as the active nav section only while it's actually visible in the
  // viewport, so the "Reviews" header link highlights on scroll — not just on the home route.
  useEffect(() => {
    const node = document.getElementById(SECTION_ID);
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => setActiveSection(entry.isIntersecting ? SECTION_ID : null),
      { threshold: 0.4 },
    );

    observer.observe(node);
    return () => {
      observer.disconnect();
      setActiveSection(null);
    };
  }, [setActiveSection]);

  return (
    <Section id="testimonials" ariaLabelledBy="testimonials-heading">
      <SectionHeading
        id="testimonials-heading"
        title={t('landing.testimonials.heading')}
        headingClassName="mb-8"
      />

      <Marquee gap={16} duration={30}>
        {testimonials.map((testimonial) => (
          <div key={testimonial.id} className="w-72 sm:w-80">
            <ReviewCard
              name={testimonial.name}
              role={t(`landing.testimonials.items.${testimonial.id}.role`)}
              quote={t(`landing.testimonials.items.${testimonial.id}.quote`)}
              rating={testimonial.rating}
            />
          </div>
        ))}
      </Marquee>
    </Section>
  );
}
