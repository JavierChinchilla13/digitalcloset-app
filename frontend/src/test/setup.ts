import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Task 23: shared test setup. Unmount anything a test rendered and wipe
// localStorage so persisted zustand stores (auth, closet, persona) never leak
// state from one test into the next.
afterEach(() => {
  cleanup();
  localStorage.clear();
});

// Browser APIs jsdom doesn't implement but framer-motion / the layout code
// touch. Inert stand-ins are enough: nothing in these tests depends on real
// layout, only on what gets rendered and called.
class NoopObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
globalThis.IntersectionObserver ??= NoopObserver as unknown as typeof IntersectionObserver;
globalThis.ResizeObserver ??= NoopObserver as unknown as typeof ResizeObserver;
window.matchMedia ??= ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener() {},
  removeEventListener() {},
  addListener() {},
  removeListener() {},
  dispatchEvent: () => false,
})) as typeof window.matchMedia;
window.scrollTo = () => {};
