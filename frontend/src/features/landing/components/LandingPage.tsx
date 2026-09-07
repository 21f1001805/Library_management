'use client';

import { useEffect } from 'react';

import { Community } from './Community';
import { CTA } from './CTA';
import { FAQ } from './FAQ';
import { Features } from './Features';
import { Hero } from './Hero';
import { HowItWorks } from './HowItWorks';
import { PlatformPreview } from './PlatformPreview';
import { ShareReviews } from './ShareReviews';
import { Testimonials } from './Testimonials';
import { Footer } from './Footer';

export function LandingPage() {
  // Next's router has no hash-aware location hook (the hash never reaches the server, so
  // it isn't part of Next's routing model at all) — read it directly on mount instead,
  // same as any plain client-side anchor-scroll would.
  useEffect(() => {
    const hash = window.location.hash?.slice(1);
    if (!hash) return;

    const section = document.getElementById(hash);
    if (!section) return;

    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  return (
    <>
      <Hero />
      <PlatformPreview />
      <Features />
      <HowItWorks />
      <ShareReviews />
      <Community />
      <Testimonials />
      <FAQ />
      <CTA />
      <Footer />
    </>
  );
}
