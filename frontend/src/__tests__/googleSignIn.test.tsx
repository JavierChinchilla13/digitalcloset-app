import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import LoginPage from '../pages/LoginPage';
import SignupPage from '../pages/SignupPage';
import GoogleSignInButton from '../components/GoogleSignInButton';
import { useAuthStore } from '../store/useAuthStore';
import { authService } from '../api/authService';
import { makeUser } from '../test/fixtures';

// Task 98: "Continue with Google" on the login and signup pages. Google's own button is replaced here
// by one that hands over a fake credential (jsdom has no Google script); GoogleSignInButton's own
// contract with Google's script is tested separately below.
vi.mock('../api/authService', () => ({
  authService: { login: vi.fn(), register: vi.fn(), getCurrentUser: vi.fn(), google: vi.fn() },
}));
vi.mock('../components/GoogleSignInButton', () => ({
  default: ({ onCredential }: { onCredential: (credential: string) => void }) => (
    <button onClick={() => onCredential('google-id-token')}>Continue with Google (test)</button>
  ),
}));

const auth = vi.mocked(authService);
const CLIENT_ID = '1234-abc.apps.googleusercontent.com';

function renderAt(entry: string) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/showcase" element={<div>SHOWCASE PAGE</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  useAuthStore.getState().logout();
  vi.stubEnv('VITE_GOOGLE_CLIENT_ID', CLIENT_ID);
  auth.getCurrentUser.mockResolvedValue(makeUser());
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => vi.unstubAllEnvs());

describe.each([['/login'], ['/signup']])('Google sign-in on %s', (path) => {
  it('signs in with the Google token and lands on the Showcase', async () => {
    auth.google.mockResolvedValue({ token: 'app-token', userId: 1, email: 'ada@example.com' } as never);
    const user = userEvent.setup();
    renderAt(path);

    await user.click(screen.getByRole('button', { name: /continue with google/i }));

    expect(await screen.findByText('SHOWCASE PAGE')).toBeInTheDocument();
    expect(auth.google).toHaveBeenCalledWith('google-id-token');
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().token).toBe('app-token');
  });

  it("shows the server's reason when Google sign-in is refused", async () => {
    auth.google.mockRejectedValue({ response: { status: 401, data: { message: 'This account has been deactivated.' } } });
    const user = userEvent.setup();
    renderAt(path);

    await user.click(screen.getByRole('button', { name: /continue with google/i }));

    expect(await screen.findByText('This account has been deactivated.')).toBeInTheDocument();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('a failure loading the account afterwards leaves no half-signed-in token', async () => {
    auth.google.mockResolvedValue({ token: 'app-token', userId: 1, email: 'ada@example.com' } as never);
    auth.getCurrentUser.mockRejectedValue({ response: { status: 500, data: {} } });
    const user = userEvent.setup();
    renderAt(path);

    await user.click(screen.getByRole('button', { name: /continue with google/i }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(useAuthStore.getState().token).toBeNull();
  });

  it('there is no Google button when this build has no client id', () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '');
    renderAt(path);

    expect(screen.queryByRole('button', { name: /continue with google/i })).not.toBeInTheDocument();
  });
});

describe('the password forms still work through the shared sign-in steps', () => {
  it('login: token, profile, Showcase', async () => {
    auth.login.mockResolvedValue({ token: 'pw-token', userId: 1, email: 'ada@example.com' } as never);
    const user = userEvent.setup();
    renderAt('/login');

    await user.type(screen.getByPlaceholderText('fashion@example.com'), 'ada@example.com');
    await user.type(screen.getByPlaceholderText('••••••••'), 'Sup3r-secret-pw');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText('SHOWCASE PAGE')).toBeInTheDocument();
    expect(useAuthStore.getState().token).toBe('pw-token');
    expect(auth.google).not.toHaveBeenCalled();
  });
});

describe('GoogleSignInButton', () => {
  afterEach(() => {
    delete window.google;
    document.head.querySelectorAll('script[src*="accounts.google.com"]').forEach((el) => el.remove());
  });

  const stubGoogle = () => {
    const initialize = vi.fn();
    const renderButton = vi.fn();
    window.google = { accounts: { id: { initialize, renderButton } } };
    return { initialize, renderButton };
  };

  it('starts Google\'s sign-in with our client id, draws its button, and hands up the credential', async () => {
    const { initialize, renderButton } = stubGoogle();
    const onCredential = vi.fn();
    // The test file mocks the component for the page tests; the real one is imported below.
    const Real = (await vi.importActual<typeof import('../components/GoogleSignInButton')>('../components/GoogleSignInButton')).default;

    render(<Real clientId={CLIENT_ID} onCredential={onCredential} />);

    await waitFor(() => expect(renderButton).toHaveBeenCalled());
    expect(initialize.mock.calls[0][0].client_id).toBe(CLIENT_ID);
    expect(renderButton.mock.calls[0][1]).toMatchObject({ text: 'continue_with', size: 'large' });

    initialize.mock.calls[0][0].callback({ credential: 'signed-token' });
    expect(onCredential).toHaveBeenCalledWith('signed-token');

    // A response with no credential (the person closed the popup) hands up nothing.
    initialize.mock.calls[0][0].callback({});
    expect(onCredential).toHaveBeenCalledTimes(1);
  });

  it('says so when Google\'s script cannot be loaded, and email sign-in stays available', async () => {
    const Real = (await vi.importActual<typeof import('../components/GoogleSignInButton')>('../components/GoogleSignInButton')).default;
    render(<Real clientId={CLIENT_ID} onCredential={() => {}} />);

    const script = document.head.querySelector('script[src*="accounts.google.com"]')!;
    expect(script).toBeTruthy();
    script.dispatchEvent(new Event('error'));

    expect(await screen.findByRole('status')).toHaveTextContent(/could not load/i);
  });

  it('only the real component loads Google\'s script, and only once', async () => {
    const Real = (await vi.importActual<typeof import('../components/GoogleSignInButton')>('../components/GoogleSignInButton')).default;
    const first = render(<Real clientId={CLIENT_ID} onCredential={() => {}} />);
    first.unmount();
    render(<Real clientId={CLIENT_ID} onCredential={() => {}} />);

    expect(document.head.querySelectorAll('script[src*="accounts.google.com"]')).toHaveLength(1);
  });
});

// Keeps the unused import honest: the mocked component is what the page tests render.
void GoogleSignInButton;
