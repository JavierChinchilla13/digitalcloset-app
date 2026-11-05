import { expect, test } from '@playwright/test';
import { chooseCookies, registerAccount, seedGarments, signIn } from './helpers';

// Flows 3 and 4: building an outfit from closet pieces and saving it, then seeing it in the saved list and the Showcase.
test('an outfit built in the builder is saved, listed, and shown in the Showcase as the main outfit', async ({ page, request }) => {
  await chooseCookies(page);
  const account = await registerAccount(request, 'outfit');
  await seedGarments(request, account, 1, { prefix: 'Linen Shirt', category: 'TOP' });
  await seedGarments(request, account, 1, { prefix: 'Dark Pants', category: 'BOTTOM' });

  await signIn(page, account.email);
  await page.goto('/outfits/flat/new');

  // Pick both pieces from the closet column.
  await page.getByText('Linen Shirt 1', { exact: true }).first().click();
  await page.getByText('Dark Pants 1', { exact: true }).first().click();
  await expect(page.getByText('2 items selected', { exact: false })).toBeVisible();

  await page.getByRole('button', { name: /save to collection/i }).click();

  // Saved: the list of outfits shows it.
  await page.waitForURL('**/outfits');
  await expect(page.getByText('New Style', { exact: false }).first()).toBeVisible();

  // The first outfit becomes the main one and is what the Showcase opens on.
  await page.goto('/showcase');
  await expect(page.getByTestId('main-outfit-tag')).toBeVisible();
  await expect(page.getByTestId('first-run-panel')).toHaveCount(0);
});
