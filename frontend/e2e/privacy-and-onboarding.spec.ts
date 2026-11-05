import { expect, test } from '@playwright/test';
import { chooseCookies, registerAccount, signIn } from './helpers';

// Flow 6: the cookie banner, the legal pages, and that nothing optional runs before consent.
test.describe('privacy', () => {
  test('the banner asks first, remembers the choice, and no ad script loads before "Accept all"', async ({ page }) => {
    const adRequests: string[] = [];
    page.on('request', (request) => {
      if (/googlesyndication|googletagmanager|adsterra/i.test(request.url())) adRequests.push(request.url());
    });

    await page.goto('/');
    const banner = page.getByTestId('consent-banner');
    await expect(banner).toBeVisible();

    // The banner links to the Privacy Policy (the footer links sit behind it until a choice is made).
    await banner.getByRole('link', { name: /privacy policy/i }).click();
    await expect(page.getByRole('heading', { level: 1, name: /privacy policy/i })).toBeVisible();

    await banner.getByRole('button', { name: 'Only essentials' }).click();
    await expect(banner).toBeHidden();

    // The legal pages are public and linked from every page's footer.
    await page.getByRole('navigation', { name: 'Legal' }).getByRole('link', { name: 'Terms' }).click();
    await expect(page.getByRole('heading', { level: 1, name: /terms of service/i })).toBeVisible();

    // The choice survives a reload, and can be reopened from the footer.
    await page.reload();
    await expect(page.getByTestId('consent-banner')).toBeHidden();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('vysvi-consent') ?? '{}').state.choice)).toBe('essential');
    await page.getByRole('button', { name: 'Cookie settings' }).click();
    await expect(page.getByTestId('consent-banner')).toBeVisible();

    expect(adRequests).toEqual([]);
  });
});

// Flow 7: a brand-new account is guided, and a sample garment can be added with one tap.
test.describe('onboarding', () => {
  test('a new account adds a sample garment from the guide and finds it in the closet', async ({ page, request }) => {
    await chooseCookies(page);
    const account = await registerAccount(request, 'onboarding');
    await signIn(page, account.email);

    const guide = page.getByTestId('first-run-panel');
    await expect(guide).toBeVisible();
    await guide.getByRole('button', { name: 'Add Black Tee' }).click();
    await expect(guide.getByRole('button', { name: 'Black Tee (added)' })).toBeVisible();

    await page.goto('/closet');
    await expect(page.getByText('Black Tee').first()).toBeVisible();
    await expect(page.getByText('1 / 15 garments')).toBeVisible();

    // The guide can be hidden for good.
    await page.goto('/showcase');
    await page.getByRole('button', { name: /hide this guide/i }).click();
    await expect(page.getByTestId('first-run-panel')).toHaveCount(0);
    await page.reload();
    await expect(page.getByTestId('first-run-panel')).toHaveCount(0);
  });
});
