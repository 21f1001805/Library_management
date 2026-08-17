import { animate, useMotionValue, useMotionValueEvent } from 'framer-motion';
import { useEffect, useState } from 'react';

export interface AnimatedNumberProps {
  value: number;
  /** Intl.NumberFormat locale used to render the tweened value. */
  locale?: string;
  className?: string;
}

// Tweens the displayed number toward `value` whenever it changes (e.g. switching
// pricing durations), instead of just replacing the text. Falls back to an
// instant jump under prefers-reduced-motion.
export function AnimatedNumber({ value, locale = 'en-IN', className }: AnimatedNumberProps) {
  const motionValue = useMotionValue(value);
  const [display, setDisplay] = useState(value);

  useMotionValueEvent(motionValue, 'change', (latest) => {
    setDisplay(Math.round(latest));
  });

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      motionValue.set(value);
      return;
    }
    const controls = animate(motionValue, value, { duration: 0.6, ease: 'easeOut' });
    return controls.stop;
  }, [value, motionValue]);

  return <span className={className}>{new Intl.NumberFormat(locale).format(display)}</span>;
}
