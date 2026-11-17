import { expect, test as base, type Browser, type BrowserContext } from '@playwright/test';

// RULE: no test may reach a real external host (Cloudinary, Stripe, Google, fonts, analytics...). Every browser context a test uses is
// guarded: a request to any host other than this machine is ABORTED and recorded, and the test FAILS at the end if there was one.
// Stand-ins must be explicit (page.route(...) with a fulfilled answer, as the upload test does for Cloudinary). A page.route set by a
// test takes precedence over this guard, so an explicit stub still works.
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

// Adds the guard to a context; offending addresses are pushed to `violations`.
export async function guardNetwork(context: BrowserContext, violations: string[]): Promise<void> {
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.protocol !== 'http:' && url.protocol !== 'https:' && url.protocol !== 'ws:' && url.protocol !== 'wss:') return route.continue();
    if (LOCAL_HOSTS.has(url.hostname)) return route.continue();
    violations.push(`${route.request().method()} ${url.href}`);
    return route.abort('blockedbyclient');
  });
}

interface Fixtures {
  // The addresses this test tried to reach outside the machine (must stay empty).
  networkViolations: string[];
  // A new guarded browser context (for the tests that need a second visitor).
  newGuardedContext: () => Promise<BrowserContext>;
}

export const test = base.extend<Fixtures>({
  networkViolations: [
    async ({}, use) => {
      const violations: string[] = [];
      await use(violations);
      expect(violations, 'the test tried to reach a real external host; add an explicit stub').toEqual([]);
    },
    { auto: true },
  ],

  context: async ({ context, networkViolations }, use) => {
    await guardNetwork(context, networkViolations);
    await use(context);
  },

  newGuardedContext: async ({ browser, networkViolations }, use) => {
    const created: BrowserContext[] = [];
    await use(async () => {
      const context = await (browser as Browser).newContext({ baseURL: 'http://localhost:4173' });
      await guardNetwork(context, networkViolations);
      created.push(context);
      return context;
    });
    await Promise.all(created.map((c) => c.close()));
  },
});

export { expect };
