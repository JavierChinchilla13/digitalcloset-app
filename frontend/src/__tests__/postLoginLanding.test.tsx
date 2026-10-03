import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import LoginPage from '../pages/LoginPage';
import SignupPage from '../pages/SignupPage';
import NotFoundPage from '../pages/NotFoundPage';
import { useAuthStore } from '../store/useAuthStore';
import { authService } from '../api/authService';
import { Role } from '../types';

// Task 90: signing in (or creating an account) lands on /showcase, the user's
// outfits; "home" on the 404 page means the Showcase for a signed-in user and
// the landing page for a visitor.
vi.mock('../api/authService', () => ({
  authService: { login: vi.fn(), register: vi.fn(), getCurrentUser: vi.fn() },
}));
const auth = vi.mocked(authService);

const ME = {
  userId: 1,
  email: 'me@example.com',
  role: Role.ROLE_USER,
  active: true,
  createdAt: '2026-01-01T00:00:00',
};

function renderAt(entry: string) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/showcase" element={<div>SHOWCASE PAGE</div>} />
        <Route path="/" element={<div>LANDING OR ATTIRE</div>} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.getState().logout();
  auth.getCurrentUser.mockResolvedValue(ME as never);
});

describe('where the user lands after authenticating', () => {
  it('login goes to /showcase', async () => {
    auth.login.mockResolvedValue({ token: 't', userId: 1, email: ME.email } as never);
    const user = userEvent.setup();
    renderAt('/login');

    await user.type(screen.getByPlaceholderText('fashion@example.com'), 'me@example.com');
    await user.type(screen.getByPlaceholderText('••••••••'), 'Sup3r-secret-pw');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText('SHOWCASE PAGE')).toBeInTheDocument();
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('a failed login stays on the page and shows the server message', async () => {
    auth.login.mockRejectedValue({ response: { data: { message: 'Invalid email or password' } } });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const user = userEvent.setup();
    renderAt('/login');

    await user.type(screen.getByPlaceholderText('fashion@example.com'), 'me@example.com');
    await user.type(screen.getByPlaceholderText('••••••••'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText('Invalid email or password')).toBeInTheDocument();
    expect(screen.queryByText('SHOWCASE PAGE')).not.toBeInTheDocument();
  });

  it('signup goes to /showcase too', async () => {
    auth.register.mockResolvedValue({ token: 't', userId: 1, email: ME.email } as never);
    const user = userEvent.setup();
    renderAt('/signup');

    await user.type(screen.getByPlaceholderText('fashion@example.com'), 'me@example.com');
    await user.type(screen.getByPlaceholderText('••••••••'), 'Sup3r-secret-pw');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByText('SHOWCASE PAGE')).toBeInTheDocument();
  });
});

describe('"Back to home" on the 404 page', () => {
  it('takes a visitor to the landing page', () => {
    renderAt('/nope');
    expect(screen.getByRole('link', { name: /back to home/i })).toHaveAttribute('href', '/');
  });

  it('takes a signed-in user to the Showcase', () => {
    useAuthStore.getState().login('t', ME as never);
    renderAt('/nope');
    expect(screen.getByRole('link', { name: /back to home/i })).toHaveAttribute('href', '/showcase');
  });
});
