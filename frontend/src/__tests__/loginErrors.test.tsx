import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import LoginPage from '../pages/LoginPage';
import SignupPage from '../pages/SignupPage';
import { useAuthStore } from '../store/useAuthStore';
import { authService } from '../api/authService';
import { NETWORK_ERROR_MESSAGE } from '../utils/apiError';

// Task 95: signing in or creating an account always ends with something on screen - the
// server's reason, a "can't reach the server" sentence, or the session-ended notice.
vi.mock('../api/authService', () => ({
  authService: { login: vi.fn(), register: vi.fn(), getCurrentUser: vi.fn() },
}));
const auth = vi.mocked(authService);

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/showcase" element={<div>SHOWCASE PAGE</div>} />
      </Routes>
    </MemoryRouter>
  );
}

async function submitLogin(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByPlaceholderText('fashion@example.com'), 'nobody@example.com');
  await user.type(screen.getByPlaceholderText('••••••••'), 'wrong-password');
  await user.click(screen.getByRole('button', { name: /sign in/i }));
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  useAuthStore.getState().logout();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('login failures are explained', () => {
  it('a wrong email or password shows the server message and the button comes back', async () => {
    auth.login.mockRejectedValue({ response: { status: 401, data: { message: 'Invalid email or password' } } });
    const user = userEvent.setup();
    renderLogin();

    await submitLogin(user);

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
    expect(screen.getByRole('button', { name: /sign in/i })).toBeEnabled();
  });

  it('a server that does not answer says it can not be reached - not "invalid credentials"', async () => {
    auth.login.mockRejectedValue({ isAxiosError: true, code: 'ERR_NETWORK', message: 'Network Error' });
    const user = userEvent.setup();
    renderLogin();

    await submitLogin(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(NETWORK_ERROR_MESSAGE);
  });

  it('too many attempts says to wait', async () => {
    auth.login.mockRejectedValue({ response: { status: 429, data: {} } });
    const user = userEvent.setup();
    renderLogin();

    await submitLogin(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(/too many attempts/i);
  });

  it('if the profile can not be loaded after a good login, no half-signed-in token is left behind', async () => {
    auth.login.mockResolvedValue({ token: 'tok', userId: 1, email: 'x@y.z' } as never);
    auth.getCurrentUser.mockRejectedValue({ response: { status: 500, data: {} } });
    const user = userEvent.setup();
    renderLogin();

    await submitLogin(user);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('being sent back because the session ended is explained once', () => {
    sessionStorage.setItem('session-expired', '1');
    const { unmount } = renderLogin();
    expect(screen.getByRole('status')).toHaveTextContent(/your session has ended/i);
    unmount();

    renderLogin();
    expect(screen.queryByText(/your session has ended/i)).not.toBeInTheDocument();
  });
});

describe('signup failures are explained', () => {
  async function submitSignup(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('link', { name: /create one now/i }));
    await user.type(screen.getByPlaceholderText(/fashion@example\.com/i), 'new@example.com');
    const passwords = screen.getAllByPlaceholderText('••••••••');
    await user.type(passwords[0], 'Sup3r-secret-pw');
    await user.click(screen.getByRole('button', { name: /create|sign up|join/i }));
  }

  it('a taken email shows the server message', async () => {
    auth.register.mockRejectedValue({ response: { status: 409, data: { message: 'An account with this email already exists' } } });
    const user = userEvent.setup();
    renderLogin();

    await submitSignup(user);

    expect(await screen.findByText('An account with this email already exists')).toBeInTheDocument();
  });

  it('a password the server rejects shows the reason, not "Validation failed"', async () => {
    auth.register.mockRejectedValue({
      response: { status: 400, data: { message: 'Validation failed', errors: { password: 'Password must be at least 8 characters' } } },
    });
    const user = userEvent.setup();
    renderLogin();

    await submitSignup(user);

    expect(await screen.findByText('Password must be at least 8 characters')).toBeInTheDocument();
  });
});
