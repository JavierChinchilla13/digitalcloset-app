import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import MainLayout from '../layouts/MainLayout';
import LoginPage from '../pages/LoginPage';
import SignupPage from '../pages/SignupPage';
import LandingPage from '../pages/LandingPage';
import PrivacyPage from '../pages/PrivacyPage';
import TermsPage from '../pages/TermsPage';
import UserMenu from '../components/UserMenu';
import MobileMenu from '../components/MobileMenu';
import { ToastProvider } from '../components/Toast';
import { LANGUAGE_STORAGE_KEY, translate, useLanguageStore } from '../i18n';
import { useAuthStore } from '../store/useAuthStore';
import { useConsentStore } from '../store/useConsentStore';
import { authService } from '../api/authService';
import { makeUser } from '../test/fixtures';
import { getApiErrorMessage } from '../utils/apiError';

vi.mock('../api/authService', () => ({
  authService: { login: vi.fn(), register: vi.fn(), getCurrentUser: vi.fn(), google: vi.fn(), googleComplete: vi.fn() },
}));
vi.mock('../api/billingService', () => ({
  billingService: { getStatus: vi.fn(async () => ({ enabled: false, plan: 'FREE', subscriptionStatus: null, currentPeriodEnd: null, cancelAtPeriodEnd: false, canManage: false, priceLabel: null })), startCheckout: vi.fn(), openPortal: vi.fn() },
}));
vi.mock('../api/premiumInterestService', () => ({
  premiumInterestService: { getState: vi.fn(async () => ({ requested: false, requestedAt: null })), request: vi.fn(), getAdminSummary: vi.fn() },
}));

const ONLY_ENGLISH_NOTE = 'Los textos legales están disponibles solo en inglés por ahora.';

function renderApp(entry = '/login') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <ToastProvider>
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/terms" element={<TermsPage />} />
          </Route>
        </Routes>
      </ToastProvider>
    </MemoryRouter>
  );
}

const footerToggle = () => screen.getByTestId('language-toggle-footer');

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.getState().logout();
  useConsentStore.setState({ choice: 'essential', decidedAt: '2026-11-01T00:00:00Z', reopened: false });
});

describe('the language toggle', () => {
  it('shows the OTHER language: "Español" while in English, "English" while in Spanish', async () => {
    const user = userEvent.setup();
    renderApp();
    expect(footerToggle()).toHaveTextContent('Español');

    await user.click(footerToggle());
    expect(footerToggle()).toHaveTextContent('English');
  });

  it('is on login, signup and landing pages for signed-out visitors (in the footer)', async () => {
    for (const path of ['/login', '/signup', '/']) {
      const { unmount } = renderApp(path);
      expect(footerToggle(), path).toBeInTheDocument();
      unmount();
    }
  });

  it('switches the text of the page and goes back', async () => {
    const user = userEvent.setup();
    renderApp('/login');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Welcome Back');
    expect(screen.getByRole('button', { name: 'SIGN IN' })).toBeInTheDocument();

    await user.click(footerToggle());
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Bienvenido de nuevo');
    expect(screen.getByRole('button', { name: 'INICIAR SESIÓN' })).toBeInTheDocument();
    expect(screen.getByText('¿No tienes una cuenta?')).toBeInTheDocument();
    // The footer and the navbar follow too.
    expect(screen.getByRole('link', { name: 'Privacidad' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toBeInTheDocument();

    await user.click(footerToggle());
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Welcome Back');
  });

  it('keeps the cookie banner, sign-up fields (including the month names) and the landing page in Spanish too', async () => {
    useConsentStore.setState({ choice: 'unset', decidedAt: null, reopened: false });
    const user = userEvent.setup();
    const { unmount } = renderApp('/signup');
    await user.click(footerToggle());
    expect(screen.getByRole('dialog', { name: 'Opciones de privacidad' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aceptar todo' })).toBeInTheDocument();
    expect(screen.getByLabelText('Mes')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Enero' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Acepto los/)).toBeInTheDocument();
    unmount();

    renderApp('/');
    expect(screen.getByText('EMPEZAR')).toBeInTheDocument();
    expect(screen.getByText('VER DEMO')).toBeInTheDocument();
  });

  it('updates <html lang>', async () => {
    const user = userEvent.setup();
    renderApp();
    expect(document.documentElement.lang).toBe('en');
    await user.click(footerToggle());
    expect(document.documentElement.lang).toBe('es');
    await user.click(footerToggle());
    expect(document.documentElement.lang).toBe('en');
  });

  it('remembers the choice in localStorage only, and reads it back after a reload', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(footerToggle());
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('es');
    // Nothing else was stored for it: no account, no server.
    expect(Object.keys(localStorage).filter((key) => /lang/i.test(key))).toEqual([LANGUAGE_STORAGE_KEY]);

    // A "reload": a fresh copy of the module reads the stored choice.
    vi.resetModules();
    const fresh = await import('../i18n');
    expect(fresh.useLanguageStore.getState().language).toBe('es');
    expect(document.documentElement.lang).toBe('es');
  });

  it('opens in English when nothing (or something unknown) is stored', async () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'fr');
    vi.resetModules();
    const fresh = await import('../i18n');
    expect(fresh.useLanguageStore.getState().language).toBe('en');
  });

  it('is a real button operable from the keyboard (Tab, then Enter or Space), with a name that says what it does', async () => {
    const user = userEvent.setup();
    renderApp();
    const toggle = footerToggle();
    expect(toggle.tagName).toBe('BUTTON');
    expect(toggle).toHaveAccessibleName('Switch the site to Español');

    toggle.focus();
    expect(toggle).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(useLanguageStore.getState().language).toBe('es');
    expect(footerToggle()).toHaveAccessibleName('Cambiar el sitio a English');

    footerToggle().focus();
    await user.keyboard(' ');
    expect(useLanguageStore.getState().language).toBe('en');
  });

  it('is reachable by Tab in the footer, after the cookie settings button', async () => {
    const user = userEvent.setup();
    renderApp();
    screen.getByRole('button', { name: 'Cookie settings' }).focus();
    await user.tab();
    expect(footerToggle()).toHaveFocus();
  });

  it('marks the label with its own language (so a screen reader reads "Español" in Spanish) and announces the change once', async () => {
    const user = userEvent.setup();
    renderApp();
    expect(within(footerToggle()).getByText('Español')).toHaveAttribute('lang', 'es');
    expect(screen.getByTestId('language-announcer')).toBeEmptyDOMElement();

    await user.click(footerToggle());
    expect(within(footerToggle()).getByText('English')).toHaveAttribute('lang', 'en');
    expect(screen.getByTestId('language-announcer')).toHaveTextContent('Idioma cambiado a español');
    expect(screen.getByTestId('language-announcer')).toHaveAttribute('aria-live', 'polite');

    await user.click(footerToggle());
    expect(screen.getByTestId('language-announcer')).toHaveTextContent('Language changed to English');
  });
});

describe('the legal pages', () => {
  it('show no note in English', () => {
    renderApp('/privacy');
    expect(screen.queryByTestId('legal-english-only-note')).not.toBeInTheDocument();
    expect(screen.queryByText(ONLY_ENGLISH_NOTE)).not.toBeInTheDocument();
  });

  it('keep the English text in Spanish and show the one note in Spanish, on both pages', async () => {
    const user = userEvent.setup();
    for (const path of ['/privacy', '/terms']) {
      const { unmount } = renderApp(path);
      await user.click(footerToggle());
      expect(screen.getByTestId('legal-english-only-note')).toHaveTextContent(ONLY_ENGLISH_NOTE);
      expect(screen.getByTestId('legal-english-only-note')).toHaveAttribute('lang', 'es');
      // The legal text itself is still English, and marked as such.
      const article = document.querySelector('article')!;
      expect(article).toHaveAttribute('lang', 'en');
      expect(article.textContent).toMatch(/Last updated: /);
      expect(article.textContent).toMatch(/Terms of Service|Privacy Policy/);
      await user.click(footerToggle());
      unmount();
    }
  });
});

describe('the menus of a signed-in account', () => {
  beforeEach(() => {
    useAuthStore.getState().login('t', makeUser({ email: 'ada@example.com' }));
    vi.mocked(authService.getCurrentUser).mockResolvedValue(makeUser());
  });

  it('the user menu has the toggle right UNDER the user (the email line), and switching works from there', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ToastProvider>
          <UserMenu />
        </ToastProvider>
      </MemoryRouter>
    );
    await user.click(screen.getByRole('button', { name: 'Account menu' }));
    const email = screen.getByText('ada@example.com');
    const toggle = screen.getByTestId('language-toggle-menu');
    expect(email.compareDocumentPosition(toggle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // And before the rest of the menu (Persona, Categories, Settings...).
    expect(toggle.compareDocumentPosition(screen.getByRole('link', { name: 'Persona' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    await user.click(toggle);
    expect(screen.getByRole('link', { name: 'Ajustes' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Categorías' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Menú de la cuenta' })).toBeInTheDocument();
  });

  it('the phone menu has the toggle too', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ToastProvider>
          <MobileMenu isOpen onClose={() => {}} />
        </ToastProvider>
      </MemoryRouter>
    );
    const toggle = screen.getByTestId('language-toggle-row');
    expect(toggle).toHaveTextContent('Español');
    await user.click(toggle);
    expect(screen.getByRole('link', { name: 'Vitrina' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Clóset' })).toBeInTheDocument();
    expect(toggle).toHaveTextContent('English');
  });
});

describe('error messages', () => {
  it('a stable error code is translated; an unmapped server message stays as the server sent it', async () => {
    useLanguageStore.getState().setLanguage('es');
    const refusal = { response: { status: 403, data: { code: 'AGE_NOT_ALLOWED', message: "We can't create an account with this information." } } };
    expect(getApiErrorMessage(refusal, 'x')).toBe('No podemos crear una cuenta con esta información.');
    expect(getApiErrorMessage({ response: { status: 409, data: { message: 'An account with this email already exists' } } }, 'x'))
      .toBe('An account with this email already exists');
    expect(getApiErrorMessage({ response: { status: 429, data: {} } }, 'x')).toBe('Demasiados intentos. Espera un minuto e inténtalo de nuevo.');
    expect(translate('error.generic')).toBe('Algo salió mal. Inténtalo de nuevo.');

    useLanguageStore.getState().setLanguage('en');
    expect(getApiErrorMessage(refusal, 'x')).toBe("We can't create an account with this information.");
  });
});
