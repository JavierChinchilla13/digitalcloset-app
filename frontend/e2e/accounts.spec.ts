import { expect, test } from '@playwright/test';
import { chooseCookies, PASSWORD, registerAccount, uniqueEmail } from './helpers';

// Flow 1: creating an account and signing in, and what a wrong password looks like.
test.describe('accounts', () => {
  test.beforeEach(async ({ page }) => {
    await chooseCookies(page);
  });

  test('a new visitor signs up and lands on the Showcase with the getting-started guide', async ({ page }) => {
    await page.goto('/signup');
    await page.getByPlaceholder('Alexander').fill('Ada');
    await page.getByPlaceholder('McQueen').fill('Lovelace');
    await page.getByPlaceholder('fashion@example.com').fill(uniqueEmail('signup'));
    await page.locator('input[type="password"]').fill(PASSWORD);
    await page.locator('button[type="submit"]').click();

    await page.waitForURL('**/showcase');
    await expect(page.getByTestId('first-run-panel')).toBeVisible();
  });

  test('a wrong password says so and stays on the sign-in page', async ({ page, request }) => {
    const account = await registerAccount(request, 'wrongpw');

    await page.goto('/login');
    await page.locator('input[type="email"]').fill(account.email);
    await page.locator('input[type="password"]').fill('Not-the-password-1');
    await page.locator('button[type="submit"]').click();

    await expect(page.getByText('Invalid email or password')).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('a signed-out visitor is sent to the sign-in page from a private page', async ({ page }) => {
    await page.goto('/closet');
    await expect(page).toHaveURL(/\/login$/);
  });
});
