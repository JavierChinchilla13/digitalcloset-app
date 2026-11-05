import { expect, test } from '@playwright/test';
import { chooseCookies, registerAccount, seedGarments, seedOutfit, signIn } from './helpers';

// Flow 5: sharing an outfit by a public link - anyone can open it without an account, and turning it off ends it.
test('a shared outfit opens for a signed-out visitor and stops working when the link is turned off', async ({ page, browser, request }) => {
  await chooseCookies(page);
  const account = await registerAccount(request, 'share');
  const [shirt, pants] = [
    ...(await seedGarments(request, account, 1, { prefix: 'Share Shirt', category: 'TOP' })),
    ...(await seedGarments(request, account, 1, { prefix: 'Share Pants', category: 'BOTTOM' })),
  ];
  await seedOutfit(request, account, 'Sunday Brunch', [shirt, pants]);

  // The owner opens the share dialog from the outfit card and makes the link.
  await signIn(page, account.email);
  await page.goto('/outfits');
  const card = page.locator('div', { has: page.getByRole('heading', { name: 'Sunday Brunch' }) }).first();
  await card.hover();
  await page.getByRole('button', { name: 'Share outfit' }).first().click({ force: true });

  const dialog = page.getByRole('dialog', { name: 'Share outfit' });
  await expect(dialog).toBeVisible();
  // The picture is drawn (a canvas export of the outfit).
  await expect(dialog.getByAltText(/sunday brunch on the figure/i)).toBeVisible();
  await dialog.getByRole('button', { name: /create public link/i }).click();
  const link = await dialog.getByLabel('Public link').inputValue();
  expect(link).toMatch(/\/s\/[A-Za-z0-9_-]{24}$/);

  // A visitor with no account (a separate browser context) opens the link.
  const visitor = await browser.newContext({ baseURL: 'http://localhost:4173' });
  const visitorPage = await visitor.newPage();
  await visitorPage.addInitScript(() =>
    localStorage.setItem('vysvi-consent', JSON.stringify({ state: { choice: 'essential', decidedAt: new Date().toISOString() }, version: 0 }))
  );
  const path = new URL(link).pathname;
  await visitorPage.goto(path);
  await expect(visitorPage.getByRole('heading', { name: 'Sunday Brunch' })).toBeVisible();
  await expect(visitorPage.getByRole('link', { name: /make your own outfits/i })).toBeVisible();
  // The public view carries no account details.
  expect(await visitorPage.content()).not.toContain(account.email);

  // The owner turns the link off; the same address is now a friendly dead end.
  await dialog.getByRole('button', { name: /turn off link/i }).click();
  await expect(dialog.getByRole('button', { name: /create public link/i })).toBeVisible();
  await visitorPage.reload();
  await expect(visitorPage.getByText(/no longer shared/i)).toBeVisible();

  await visitor.close();
});
