import { expect, type APIRequestContext, type Page } from '@playwright/test';

// Task 105: shared setup for the end-to-end tests. Every test makes its own account (unique email), so tests
// never depend on each other or on the order they run in.

export const PASSWORD = 'E2e-Sup3r-secret!';

let counter = 0;

// An email nobody used before in this run.
export const uniqueEmail = (prefix = 'e2e') => `${prefix}-${Date.now()}-${counter++}-${Math.floor(Math.random() * 1e6)}@example.test`;

export interface Account {
  email: string;
  userId: number;
  token: string;
}

// Creates an account through the API (faster than the sign-up form, which has its own test).
export async function registerAccount(request: APIRequestContext, prefix = 'e2e'): Promise<Account> {
  const email = uniqueEmail(prefix);
  const response = await request.post('/api/auth/register', {
    data: { firstName: 'E2E', lastName: 'Tester', email, password: PASSWORD },
  });
  expect(response.ok(), 'register through the API').toBeTruthy();
  const body = await response.json();
  return { email, userId: body.userId, token: body.token };
}

// A garment picture served by the site itself (no external image host is needed).
const IMAGE = '/samples/black-tee.png';

const TRANSFORM = { x: 375, y: 420, scaleX: 1, scaleY: 1, rotation: 0, width: 300, height: 300 };

// Adds `count` fitted male garments (named `<prefix> 1`, `<prefix> 2`, ...) to the account through the API.
export async function seedGarments(
  request: APIRequestContext,
  account: Account,
  count: number,
  options: { prefix?: string; category?: string } = {}
): Promise<number[]> {
  const ids: number[] = [];
  for (let i = 1; i <= count; i++) {
    const response = await request.post('/api/clothing', {
      headers: { Authorization: `Bearer ${account.token}` },
      data: {
        name: `${options.prefix ?? 'Seed'} ${i}`,
        category: options.category ?? 'TOP',
        imageUrl: IMAGE,
        personaType: 'MALE',
        personaStatus: 'FITTED',
        transform: TRANSFORM,
      },
    });
    expect(response.ok(), `seed garment ${i}`).toBeTruthy();
    ids.push((await response.json()).itemId);
  }
  return ids;
}

// Saves an outfit made of the given garments through the API; returns its id.
export async function seedOutfit(request: APIRequestContext, account: Account, name: string, itemIds: number[]): Promise<number> {
  const response = await request.post('/api/outfits', {
    headers: { Authorization: `Bearer ${account.token}` },
    data: {
      name,
      avatarType: 'MALE',
      items: itemIds.map((itemId, index) => ({ itemId, slot: 'top', itemOrder: index })),
    },
  });
  expect(response.ok(), 'seed outfit').toBeTruthy();
  return (await response.json()).outfitId;
}

// Pre-answers the cookie banner (before the app loads), so it cannot sit over the buttons being tested.
export async function chooseCookies(page: Page, choice: 'essential' | 'all' = 'essential'): Promise<void> {
  await page.addInitScript((value) => {
    localStorage.setItem('vysvi-consent', JSON.stringify({ state: { choice: value, decidedAt: new Date().toISOString() }, version: 0 }));
  }, choice);
}

// Signs in through the real form and waits for the landing page (the Showcase).
export async function signIn(page: Page, email: string, password = PASSWORD): Promise<void> {
  await page.goto('/login');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/showcase');
}

// A 1x1 transparent PNG, for upload tests.
export const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);
