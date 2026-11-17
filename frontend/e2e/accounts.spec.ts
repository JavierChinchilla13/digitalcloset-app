import { expect, test } from './fixtures';
import { chooseCookies, fillAgeAndConsent, PASSWORD, registerAccount, uniqueEmail } from './helpers';

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
    await fillAgeAndConsent(page, 30);
    await page.locator('button[type="submit"]').click();

    await page.waitForURL('**/showcase');
    await expect(page.getByTestId('first-run-panel')).toBeVisible();
  });

  // Audit H12: under the minimum age nothing is created, whatever else is filled in, and the answer never explains.
  test('someone under the minimum age is refused with the uniform message and no account is created', async ({ page }) => {
    const email = uniqueEmail('young');
    await page.goto('/signup');
    await page.getByPlaceholder('fashion@example.com').fill(email);
    await page.locator('input[type="password"]').fill(PASSWORD);
    await fillAgeAndConsent(page, 9);
    await page.locator('button[type="submit"]').click();

    await expect(page.getByRole('alert')).toHaveText("We can't create an account with this information.");
    await expect(page).toHaveURL(/\/signup$/);

    // No account exists: signing in with those details fails like any unknown account.
    const attempt = await page.request.post('/api/auth/login', { data: { email, password: PASSWORD }, failOnStatusCode: false });
    expect(attempt.status()).toBe(401);
  });

  test('a 13-17 year old needs the guardian declaration', async ({ page }) => {
    await page.goto('/signup');
    await page.getByPlaceholder('fashion@example.com').fill(uniqueEmail('teen'));
    await page.locator('input[type="password"]').fill(PASSWORD);
    await fillAgeAndConsent(page, 15);
    await page.locator('button[type="submit"]').click();
    await expect(page.getByRole('alert')).toContainText(/parent or legal guardian/i);

    await page.getByLabel(/legal guardian authorises/i).check();
    await page.locator('button[type="submit"]').click();
    await page.waitForURL('**/showcase');
  });

  // Audit H12: deleting the account erases it for good; signing in afterwards no longer works.
  test('deleting the account from Settings signs out and the account is gone', async ({ page, request }) => {
    const account = await registerAccount(request, 'erase');
    await page.goto('/login');
    await page.locator('input[type="email"]').fill(account.email);
    await page.locator('input[type="password"]').fill(PASSWORD);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL('**/showcase');

    await page.goto('/settings');
    await page.getByRole('button', { name: /delete my account and data/i }).click();
    await page.getByLabel(/type delete to confirm/i).fill('DELETE');
    await page.getByLabel(/your password/i).fill(PASSWORD);
    await page.getByRole('button', { name: /delete everything/i }).click();

    await page.waitForURL('**/login');
    await expect(page.getByText(/your account and data have been deleted/i)).toBeVisible();
    const attempt = await page.request.post('/api/auth/login', { data: { email: account.email, password: PASSWORD }, failOnStatusCode: false });
    expect(attempt.status()).toBe(401);
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
