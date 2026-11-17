import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import App from '../App';
import SignupPage from '../pages/SignupPage';
import ConfirmDetailsPage from '../pages/ConfirmDetailsPage';
import LoginPage from '../pages/LoginPage';
import { ToastProvider } from '../components/Toast';
import { useAuthStore } from '../store/useAuthStore';
import { authService } from '../api/authService';
import { userService } from '../api/userService';
import { LEGAL_VERSION } from '../config/legal';
import { ageBandFor, birthYearOptions, MIN_AGE } from '../utils/age';
import { makeUser } from '../test/fixtures';
import { fillAgeAndConsent } from '../test/ageForm';

// Audit H12: the age rule, the shared age/consent fields, sign-up, the "confirm your details" page for existing accounts and the
// route guard that sends them there. The age rule is also tested on the server (AgePolicyTest); both must agree.
vi.mock('../api/authService', () => ({
  authService: { login: vi.fn(), register: vi.fn(), getCurrentUser: vi.fn(), google: vi.fn(), googleComplete: vi.fn() },
}));
vi.mock('../api/userService', () => ({
  userService: { confirmLegal: vi.fn(), deleteAccount: vi.fn(), exportMyData: vi.fn() },
}));
vi.mock('../api/clothingService', () => ({ clothingService: { getClothingItems: vi.fn(async () => []) } }));
vi.mock('../api/outfitService', () => ({ outfitService: { getOutfits: vi.fn(async () => []) } }));
vi.mock('../api/collectionService', () => ({ collectionService: { getCollections: vi.fn(async () => []) } }));
vi.mock('../components/FittingTool/UploadFlow', () => ({ default: () => null }));

const auth = vi.mocked(authService);
const users = vi.mocked(userService);
const REFUSAL = "We can't create an account with this information.";

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  useAuthStore.getState().logout();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('ageBandFor (mirrors the server: you turn N at the END of your birth month)', () => {
  const today = new Date(Date.UTC(2026, 10, 16)); // 16 November 2026

  it('works the bands out from month and year only', () => {
    expect(ageBandFor(2013, 11, today)).toBe('UNDER_MIN'); // turns 13 only at the end of this month
    expect(ageBandFor(2013, 10, today)).toBe('MINOR'); // turned 13 at the end of last month
    expect(ageBandFor(2020, 1, today)).toBe('UNDER_MIN');
    expect(ageBandFor(2008, 11, today)).toBe('MINOR'); // turns 18 at the end of this month
    expect(ageBandFor(2008, 10, today)).toBe('ADULT');
    expect(ageBandFor(1990, 5, today)).toBe('ADULT');
  });

  it('refuses impossible dates', () => {
    expect(ageBandFor(2026, 12, today)).toBeNull(); // the future
    expect(ageBandFor(1990, 13, today)).toBeNull();
    expect(ageBandFor(1990, 0, today)).toBeNull();
    expect(ageBandFor(1850, 5, today)).toBeNull();
  });

  it('the year list starts this year and goes back 100 years', () => {
    const years = birthYearOptions(new Date(Date.UTC(2026, 10, 16)));
    expect(years[0]).toBe(2026);
    expect(years[years.length - 1]).toBe(1926);
  });

  it('the minimum age is one constant in one place', () => {
    expect(MIN_AGE).toBe(13);
  });
});

function renderSignup() {
  return render(
    <MemoryRouter initialEntries={['/signup']}>
      <Routes>
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/showcase" element={<div>SHOWCASE PAGE</div>} />
      </Routes>
    </MemoryRouter>
  );
}

async function fillAccount(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByPlaceholderText('fashion@example.com'), 'new@example.com');
  await user.type(screen.getByPlaceholderText('••••••••'), 'Sup3r-secret-pw');
}

describe('the age and consent fields on sign-up', () => {
  it('has labelled month and year lists, and two acceptance boxes that start unticked', () => {
    renderSignup();

    expect(screen.getByLabelText(/^month$/i)).toBeRequired();
    expect(screen.getByLabelText(/^year$/i)).toBeRequired();
    expect(screen.getByLabelText(/i accept the/i)).not.toBeChecked();
    expect(screen.getByLabelText(/i authorise the processing/i)).not.toBeChecked();
    // Two SEPARATE acceptances, and the guardian box is not there until it applies.
    expect(screen.queryByLabelText(/legal guardian authorises/i)).not.toBeInTheDocument();
  });

  it('never says what the minimum age is (a neutral age screen)', () => {
    renderSignup();
    expect(document.body.textContent).not.toMatch(/\b13\b|\b18\b|years old|minimum age/i);
  });

  it('links to the Terms and the Privacy Policy, opening in a new tab', () => {
    renderSignup();
    const terms = screen.getByRole('link', { name: /^terms/i });
    expect(terms).toHaveAttribute('href', '/terms');
    expect(terms).toHaveAttribute('target', '_blank');
    expect(terms).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(screen.getByRole('link', { name: /^privacy policy/i })).toHaveAttribute('href', '/privacy');
  });

  it('shows the guardian declaration only for someone aged 13-17, with the note that it is not verified', async () => {
    const user = userEvent.setup();
    renderSignup();

    await fillAgeAndConsent(user, { yearsAgo: 30, terms: false, data: false });
    expect(screen.queryByLabelText(/legal guardian authorises/i)).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/^year$/i), String(new Date().getUTCFullYear() - 15));
    expect(screen.getByLabelText(/legal guardian authorises/i)).not.toBeChecked();
    expect(screen.getByText(/does not verify it/i)).toBeInTheDocument();
  });

  it('is reachable and usable with the keyboard alone', async () => {
    const user = userEvent.setup();
    renderSignup();

    screen.getByLabelText(/^month$/i).focus();
    await user.keyboard('January');
    await user.tab();
    expect(screen.getByLabelText(/^year$/i)).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText(/i accept the/i)).toHaveFocus();
    await user.keyboard(' ');
    expect(screen.getByLabelText(/i accept the/i)).toBeChecked();
  });
});

describe('sign-up', () => {
  it('sends the birth month/year, the declarations and the legal version', async () => {
    auth.register.mockResolvedValue({ token: 't', userId: 1, email: 'new@example.com' } as never);
    auth.getCurrentUser.mockResolvedValue(makeUser());
    const user = userEvent.setup();
    renderSignup();

    await fillAccount(user);
    await fillAgeAndConsent(user, { yearsAgo: 30 });
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByText('SHOWCASE PAGE')).toBeInTheDocument();
    expect(auth.register).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'new@example.com',
        birthMonth: 1,
        birthYear: new Date().getUTCFullYear() - 30,
        guardianAuthorized: false,
        termsAccepted: true,
        dataAuthorized: true,
        legalVersion: LEGAL_VERSION,
      })
    );
  });

  it('a 13-17 year old must tick the guardian box, and it is sent when ticked', async () => {
    auth.register.mockResolvedValue({ token: 't', userId: 1, email: 'new@example.com' } as never);
    auth.getCurrentUser.mockResolvedValue(makeUser({ ageBand: 'MINOR' }));
    const user = userEvent.setup();
    renderSignup();

    await fillAccount(user);
    await fillAgeAndConsent(user, { yearsAgo: 15 });
    await user.click(screen.getByRole('button', { name: /create account/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/parent or legal guardian/i);
    expect(auth.register).not.toHaveBeenCalled();

    await user.click(screen.getByLabelText(/legal guardian authorises/i));
    await user.click(screen.getByRole('button', { name: /create account/i }));
    await waitFor(() => expect(auth.register).toHaveBeenCalledWith(expect.objectContaining({ guardianAuthorized: true })));
  });

  it('each acceptance is required on its own', async () => {
    const user = userEvent.setup();
    renderSignup();

    await fillAccount(user);
    await fillAgeAndConsent(user, { terms: true, data: false });
    await user.click(screen.getByRole('button', { name: /create account/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/authorise the processing/i);
    expect(auth.register).not.toHaveBeenCalled();
  });

  it('under the minimum age: the uniform message, NOTHING is sent, and the form stays locked for this tab', async () => {
    const user = userEvent.setup();
    renderSignup();

    await fillAccount(user);
    await fillAgeAndConsent(user, { yearsAgo: 9 });
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(REFUSAL);
    expect(auth.register).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /create account/i })).toBeDisabled();
    expect(screen.getByLabelText(/^year$/i)).toBeDisabled();
    // Only a flag is remembered (no date, no email).
    expect(sessionStorage.getItem('vysvi-age-blocked')).toBe('1');
    expect(JSON.stringify({ ...sessionStorage })).not.toMatch(/new@example|2017|2016|2015/);
  });

  it('coming back to the page in the same tab stays locked (changing the year does not get around it)', () => {
    sessionStorage.setItem('vysvi-age-blocked', '1');
    renderSignup();

    expect(screen.getByRole('button', { name: /create account/i })).toBeDisabled();
    expect(screen.getByLabelText(/^year$/i)).toBeDisabled();
  });

  it("the server's uniform refusal is shown the same way and locks the form", async () => {
    auth.register.mockRejectedValue({ response: { status: 403, data: { code: 'AGE_NOT_ALLOWED', message: REFUSAL } } });
    const user = userEvent.setup();
    renderSignup();

    await fillAccount(user);
    await fillAgeAndConsent(user, { yearsAgo: 30 });
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(REFUSAL);
    expect(screen.getByRole('button', { name: /create account/i })).toBeDisabled();
  });
});

function renderConfirm() {
  return render(
    <MemoryRouter initialEntries={['/confirm-details']}>
      <ToastProvider>
        <Routes>
          <Route path="/confirm-details" element={<ConfirmDetailsPage />} />
          <Route path="/showcase" element={<div>SHOWCASE PAGE</div>} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/settings" element={<div>SETTINGS PAGE</div>} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>
  );
}

describe('"confirm your details" for accounts made before the age step', () => {
  const older = () => makeUser({ ageBand: null, needsLegalConfirmation: true });

  it('asks for birth month/year and the acceptances, saves them and goes on', async () => {
    useAuthStore.getState().login('t', older());
    users.confirmLegal.mockResolvedValue(makeUser({ ageBand: 'ADULT', needsLegalConfirmation: false }));
    const user = userEvent.setup();
    renderConfirm();

    await fillAgeAndConsent(user, { yearsAgo: 30 });
    await user.click(screen.getByRole('button', { name: /confirm and continue/i }));

    expect(await screen.findByText('SHOWCASE PAGE')).toBeInTheDocument();
    expect(users.confirmLegal).toHaveBeenCalledWith(
      expect.objectContaining({ birthMonth: 1, termsAccepted: true, dataAuthorized: true, legalVersion: LEGAL_VERSION })
    );
    expect(useAuthStore.getState().user?.needsLegalConfirmation).toBe(false);
  });

  it('an account whose birth date is already recorded is not asked for it again', async () => {
    useAuthStore.getState().login('t', makeUser({ ageBand: 'ADULT', needsLegalConfirmation: true }));
    users.confirmLegal.mockResolvedValue(makeUser());
    const user = userEvent.setup();
    renderConfirm();

    expect(screen.queryByLabelText(/^month$/i)).not.toBeInTheDocument();
    await user.click(screen.getByLabelText(/i accept the/i));
    await user.click(screen.getByLabelText(/i authorise the processing/i));
    await user.click(screen.getByRole('button', { name: /confirm and continue/i }));

    await waitFor(() => expect(users.confirmLegal).toHaveBeenCalledTimes(1));
    expect(users.confirmLegal.mock.calls[0][0]).not.toHaveProperty('birthYear');
  });

  it('under the minimum age the server erases the account: signed out, local data cleared, only the uniform message shown', async () => {
    useAuthStore.getState().login('t', older());
    users.confirmLegal.mockRejectedValue({ response: { status: 403, data: { code: 'AGE_NOT_ALLOWED', message: REFUSAL } } });
    const user = userEvent.setup();
    renderConfirm();

    await fillAgeAndConsent(user, { yearsAgo: 9 });
    await user.click(screen.getByRole('button', { name: /confirm and continue/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(REFUSAL);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('offers deleting the account instead', () => {
    useAuthStore.getState().login('t', older());
    renderConfirm();
    expect(screen.getByRole('link', { name: /delete my account/i })).toHaveAttribute('href', '/settings');
  });
});

describe('the route guard', () => {
  function renderAppAt(path: string) {
    window.history.pushState({}, '', path);
    return render(
      <ToastProvider>
        <App />
      </ToastProvider>
    );
  }

  it('sends an unconfirmed account to /confirm-details from the app pages and from "/"', () => {
    auth.getCurrentUser.mockImplementation(() => new Promise(() => {}));
    useAuthStore.getState().login('t', makeUser({ ageBand: null, needsLegalConfirmation: true }));

    for (const path of ['/closet', '/outfits', '/showcase', '/']) {
      const { unmount } = renderAppAt(path);
      expect(window.location.pathname, `${path} should redirect`).toBe('/confirm-details');
      unmount();
    }
  });

  it('keeps Settings reachable so the account can be deleted instead', () => {
    auth.getCurrentUser.mockImplementation(() => new Promise(() => {}));
    useAuthStore.getState().login('t', makeUser({ ageBand: null, needsLegalConfirmation: true }));

    renderAppAt('/settings');
    expect(window.location.pathname).toBe('/settings');
  });

  it('a confirmed account is not sent anywhere', () => {
    auth.getCurrentUser.mockImplementation(() => new Promise(() => {}));
    useAuthStore.getState().login('t', makeUser());

    renderAppAt('/closet');
    expect(window.location.pathname).toBe('/closet');
  });
});
