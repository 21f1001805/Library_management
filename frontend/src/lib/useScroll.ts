import { useEffect, useState } from 'react';

export function useScroll(threshold = 0): boolean {
  // No window during Next's server render pass — the effect below (client-only) corrects
  // this immediately after hydration, same as ThemeProvider's resolveIsDark.
  const [scrolled, setScrolled] = useState(() =>
    typeof window === 'undefined' ? false : window.scrollY > threshold,
  );

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > threshold);
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);

  return scrolled;
}
