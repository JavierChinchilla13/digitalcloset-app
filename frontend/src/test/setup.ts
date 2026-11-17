import '@testing-library/jest-dom/vitest';
import { afterEach, expect } from 'vitest';
import { cleanup } from '@testing-library/react';

// Task 23: shared test setup. Unmount anything a test rendered and wipe
// localStorage so persisted zustand stores (auth, closet, persona) never leak
// state from one test into the next.
afterEach(() => {
  cleanup();
  localStorage.clear();
  // RULE: no test may reach a real external host (Cloudinary, Stripe, Google, a mail provider...). A test that tried is failed here,
  // even if the code under test swallowed the error. Stand-ins must be explicit (vi.mock of the api modules, a stubbed fetch).
  const attempted = networkViolations.splice(0);
  expect(attempted, 'a test tried to reach a real external host; use an explicit stub').toEqual([]);
});

// Hosts a test may talk to: the machine itself (the jsdom page, a stubbed local server).
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
export const networkViolations: string[] = [];
const isExternal = (rawUrl: string): boolean => {
  try {
    return !LOCAL_HOSTS.has(new URL(rawUrl, window.location.href).hostname);
  } catch {
    return false;
  }
};
const refuse = (what: string, url: string): never => {
  networkViolations.push(`${what} ${url}`);
  throw new Error(`BLOCKED IN TESTS: ${what} ${url} is a real external host. Use an explicit stub.`);
};

const realFetch = globalThis.fetch?.bind(globalThis);
globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (isExternal(url)) refuse('fetch', url);
  return realFetch ? realFetch(input, init) : Promise.reject(new Error('fetch is not available in this test'));
}) as typeof fetch;

const realOpen = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function (this: XMLHttpRequest, method: string, url: string | URL, ...rest: unknown[]) {
  if (isExternal(String(url))) refuse('XMLHttpRequest', String(url));
  return (realOpen as (...args: unknown[]) => void).call(this, method, url, ...rest);
} as typeof XMLHttpRequest.prototype.open;

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
