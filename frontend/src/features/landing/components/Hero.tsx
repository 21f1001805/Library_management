import { useTranslation } from 'react-i18next';

import { PosterWall } from './PosterWall';

export function Hero() {
  const { t } = useTranslation();

  return (
    <section
      aria-labelledby="hero-heading"
      className="relative overflow-hidden border-b border-white/5 bg-background"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-130 bg-[radial-gradient(ellipse_60%_55%_at_50%_0%,rgba(217,70,239,0.45),rgba(217,70,239,0.12)_45%,transparent_80%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-105 bg-[radial-gradient(ellipse_40%_45%_at_50%_15%,rgba(126,34,206,0.4),rgba(126,34,206,0.1)_45%,transparent_80%)]"
      />

      <div className="relative px-4 pb-24 pt-28 sm:px-6 sm:pt-32 md:pt-44">
        <PosterWall />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-linear-to-b from-transparent to-background sm:h-56"
        />
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-16 flex justify-center px-6 text-center sm:top-20">
        <h1
          id="hero-heading"
          className="text-4xl font-black tracking-tight text-white drop-shadow-[0_4px_18px_rgba(0,0,0,0.9)] sm:text-5xl md:text-6xl"
        >
          {t('landing.hero.wordmark')}
        </h1>
      </div>
    </section>
  );
}
