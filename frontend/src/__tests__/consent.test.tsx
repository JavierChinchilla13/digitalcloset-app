import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import MainLayout from '../layouts/MainLayout';
import PrivacyPage from '../pages/PrivacyPage';
import TermsPage from '../pages/TermsPage';
import AdSlot from '../components/ads/AdSlot';
import { useConsentStore } from '../store/useConsentStore';
import { useAuthStore } from '../store/useAuthStore';
import { makeUser } from '../test/fixtures';

// Task 99: the cookie / privacy choice, the legal pages, and what the choice switches on and off.
function renderApp(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<p>HOME PAGE</p>} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  localStorage.clear();
  useConsentStore.setState({ choice: 'unset', decidedAt: null, reopened: false });
  useAuthStore.getState().logout();
});

describe('the cookie banner', () => {
  it('asks until a choice is made, with two equal options', () => {
    renderApp();

    const banner = screen.getByTestId('consent-banner');
    expect(within(banner).getByRole('button', { name: 'Only essentials' })).toBeInTheDocument();
    expect(within(banner).getByRole('button', { name: 'Accept all' })).toBeInTheDocument();
    expect(within(banner).getByRole('link', { name: /privacy policy/i })).toHaveAttribute('href', '/privacy');
  });

  it('"Accept all" records the choice and hides the banner', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole('button', { name: 'Accept all' }));

    expect(screen.queryByTestId('consent-banner')).not.toBeInTheDocument();
    expect(useConsentStore.getState().choice).toBe('all');
    expect(useConsentStore.getState().decidedAt).not.toBeNull();
    expect(JSON.parse(localStorage.getItem('vysvi-consent')!).state.choice).toBe('all');
  });

  it('"Only essentials" records that nothing optional is allowed', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole('button', { name: 'Only essentials' }));

    expect(useConsentStore.getState().choice).toBe('essential');
    expect(screen.queryByTestId('consent-banner')).not.toBeInTheDocument();
  });

  it('the footer link opens the choice again so it can be changed', async () => {
    useConsentStore.setState({ choice: 'all', decidedAt: '2026-10-12T00:00:00Z', reopened: false });
    const user = userEvent.setup();
    renderApp();
    expect(screen.queryByTestId('consent-banner')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cookie settings' }));
    expect(screen.getByTestId('consent-banner')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Only essentials' }));
    expect(useConsentStore.getState().choice).toBe('essential');
    expect(screen.queryByTestId('consent-banner')).not.toBeInTheDocument();
  });

  it('does not ask again once a choice was stored', () => {
    useConsentStore.setState({ choice: 'essential', decidedAt: '2026-10-12T00:00:00Z', reopened: false });
    renderApp();
    expect(screen.queryByTestId('consent-banner')).not.toBeInTheDocument();
  });
});

describe('the footer and the legal pages (signed out)', () => {
  it('links to Privacy and Terms from every page', () => {
    renderApp();
    const legal = screen.getByRole('navigation', { name: 'Legal' });
    expect(within(legal).getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy');
    expect(within(legal).getByRole('link', { name: 'Terms' })).toHaveAttribute('href', '/terms');
  });

  it('the Privacy Policy opens without an account and names the services and storage', () => {
    renderApp('/privacy');

    expect(screen.getByRole('heading', { level: 1, name: /privacy policy/i })).toBeInTheDocument();
    for (const word of ['Render', 'Neon', 'Cloudinary', 'Stripe', 'Sentry', 'auth-storage', 'vysvi-consent', 'javidilugo@gmail.com']) {
      expect(screen.getAllByText(new RegExp(word)).length, word).toBeGreaterThan(0);
    }
    expect(screen.getByRole('note')).toHaveTextContent(/draft/i);
    expect(screen.getAllByText(/\[COUNTRY\]/).length).toBeGreaterThan(0);
  });

  it('the Privacy page can reopen the cookie choice', async () => {
    useConsentStore.setState({ choice: 'all', decidedAt: '2026-10-12T00:00:00Z', reopened: false });
    const user = userEvent.setup();
    renderApp('/privacy');

    await user.click(screen.getByRole('button', { name: /open cookie settings/i }));

    expect(screen.getByTestId('consent-banner')).toBeInTheDocument();
  });

  it('the Terms cover the subscription, cancellation and refund wording', () => {
    renderApp('/terms');

    expect(screen.getByRole('heading', { level: 1, name: /terms of service/i })).toBeInTheDocument();
    expect(screen.getByText(/cancel at any time/i)).toBeInTheDocument();
    expect(screen.getByText(/not refundable/i)).toBeInTheDocument();
    expect(screen.getAllByText(/\[COUNTRY\]/).length).toBeGreaterThan(0);
  });
});

describe('what the choice switches on', () => {
  afterEach(() => vi.unstubAllEnvs());

  const withAds = () => {
    vi.stubEnv('VITE_AD_PROVIDER', 'adsense');
    vi.stubEnv('VITE_ADSENSE_CLIENT', 'ca-pub-1234567890123456');
    vi.stubEnv('VITE_ADSENSE_SLOT', '1234567890');
    useAuthStore.getState().login('t', makeUser());
  };
  const renderSlot = () =>
    render(
      <MemoryRouter initialEntries={['/closet']}>
        <AdSlot />
      </MemoryRouter>
    );

  it('no ad and no ad script before "Accept all"', () => {
    withAds();
    document.head.querySelectorAll('script[src*="googlesyndication"]').forEach((el) => el.remove());

    renderSlot();

    expect(screen.queryByTestId('ad-slot')).not.toBeInTheDocument();
    expect(document.head.querySelectorAll('script[src*="googlesyndication"]')).toHaveLength(0);
  });

  it('no ad after "Only essentials"', () => {
    withAds();
    useConsentStore.setState({ choice: 'essential', decidedAt: '2026-10-12T00:00:00Z', reopened: false });

    renderSlot();

    expect(screen.queryByTestId('ad-slot')).not.toBeInTheDocument();
  });

  it('the ad shows once "Accept all" was chosen', () => {
    withAds();
    useConsentStore.setState({ choice: 'all', decidedAt: '2026-10-12T00:00:00Z', reopened: false });

    renderSlot();

    expect(screen.getByTestId('ad-slot')).toBeInTheDocument();
  });
});
