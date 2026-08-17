import '@testing-library/jest-dom/vitest';

// jsdom doesn't implement scrollTo; ChatbotWidget's auto-scroll-to-latest-message needs it.
Element.prototype.scrollTo ??= () => undefined;

// jsdom doesn't implement IntersectionObserver; framer-motion's whileInView (landing
// sections, the large public footer) needs it to mount without throwing.
class MockIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = '';
  readonly thresholds = [];
  observe = () => undefined;
  unobserve = () => undefined;
  disconnect = () => undefined;
  takeRecords = () => [];
}
window.IntersectionObserver ??= MockIntersectionObserver;

// jsdom doesn't implement matchMedia; AnimatedNumber's reduced-motion check needs it.
window.matchMedia ??= (query: string) =>
  ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }) as MediaQueryList;
