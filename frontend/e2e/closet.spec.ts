import { expect, test } from '@playwright/test';
import { chooseCookies, registerAccount, seedGarments, signIn, TINY_PNG } from './helpers';

// Flow 2: the free plan holds 15 garments - the 15th goes in through the upload screen, the 16th is refused.
// Cloudinary (the image host) is answered by the test, so nothing leaves the machine.
test('a free closet takes 15 garments through the upload flow, then says it is full', async ({ page, request }) => {
  await chooseCookies(page);
  const account = await registerAccount(request, 'closet');
  await seedGarments(request, account, 14);

  // The upload goes to Cloudinary; answer it with a picture the site serves itself.
  await page.route('https://api.cloudinary.com/**', (route) =>
    route.fulfill({ json: { secure_url: 'http://localhost:4173/samples/black-tee.png' } })
  );

  await signIn(page, account.email);
  await page.goto('/closet');
  await expect(page.getByText('14 / 15 garments')).toBeVisible();

  // The 15th garment, through the real upload screen (skipping background removal: the model is not under test).
  await page.getByRole('button', { name: /add new garment/i }).click();
  await expect(page.getByText('Step 1 — Initial Intake')).toBeVisible();
  await page.locator('#file-input').setInputFiles({ name: 'shirt.png', mimeType: 'image/png', buffer: TINY_PNG });
  await page.getByRole('button', { name: /skip background removal/i }).click();
  await page.getByRole('button', { name: /save to closet/i }).click();

  await expect(page.getByText('15 / 15 garments')).toBeVisible();

  // The 16th: the app explains instead of opening the upload.
  await page.getByRole('button', { name: /add new garment/i }).click();
  await expect(page.getByRole('dialog', { name: /closet is full/i })).toBeVisible();
  await expect(page.getByText('Step 1 — Initial Intake')).toHaveCount(0);

  // And the server holds the same line.
  const refused = await request.post('/api/clothing', {
    headers: { Authorization: `Bearer ${account.token}` },
    data: { name: 'one too many', category: 'TOP', imageUrl: '/samples/black-tee.png', personaType: 'MALE' },
  });
  expect(refused.status()).toBe(403);
  expect((await refused.json()).code).toBe('GARMENT_LIMIT');
});
