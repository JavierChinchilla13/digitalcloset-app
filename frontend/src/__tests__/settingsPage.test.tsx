import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

import SettingsPage from '../pages/SettingsPage';
import { ToastProvider } from '../components/Toast';
import { useAuthStore } from '../store/useAuthStore';
import { userService } from '../api/userService';
import { authService } from '../api/authService';
import { Role } from '../types';
import type { User } from '../types';

vi.mock('../api/userService', () => ({
  userService: {
    updateProfile: vi.fn(),
    requestPasswordChange: vi.fn(),
    confirmPasswordChange: vi.fn(),
    requestEmailChange: vi.fn(),
    confirmEmailChange: vi.fn(),
    deactivateMe: vi.fn(),
  },
}));
vi.mock('../api/authService', () => ({
  authService: { getCurrentUser: vi.fn() },
}));

const users = vi.mocked(userService);
const auth = vi.mocked(authService);

const baseUser: User = {
  userId: 1,
  email: 'shopper@example.com',
  firstName: 'Ada',
  lastName: 'Lovelace',
  role: Role.ROLE_USER,
  active: true,
  createdAt: '2026-01-01T00:00:00',
};

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

// The Email card also has a "Current Password" field with the same
// placeholder as the Password card's fields, so tests scope their queries to
// the Password card specifically rather than matching by placeholder alone.
function passwordCardFields() {
  return within(screen.getByTestId('password-section'));
}

function emailCardFields() {
  return within(screen.getByTestId('email-section'));
}

function renderSettings() {
  return render(
    <MemoryRouter initialEntries={['/settings']}>
      <ToastProvider>
        <LocationProbe />
        <Routes>
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>
  );
}

// Task 79: name/email/password/deactivate, each its own independent form.
describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().login('old-token', baseUser);
  });

  it('profile save updates the store with the response', async () => {
    const updated = { ...baseUser, firstName: 'Grace' };
    users.updateProfile.mockResolvedValue(updated);
    const user = userEvent.setup();
    renderSettings();

    const firstNameInput = screen.getByDisplayValue('Ada');
    await user.clear(firstNameInput);
    await user.type(firstNameInput, 'Grace');
    await user.click(screen.getByRole('button', { name: /save profile/i }));

    await waitFor(() => expect(users.updateProfile).toHaveBeenCalledWith({ firstName: 'Grace', lastName: 'Lovelace' }));
    await waitFor(() => expect(useAuthStore.getState().user?.firstName).toBe('Grace'));
    // The token itself doesn't change for a name update.
    expect(useAuthStore.getState().token).toBe('old-token');
  });

  it('a failed profile save shows a message and leaves the store alone', async () => {
    users.updateProfile.mockRejectedValue({ response: { data: { message: 'Server down' } } });
    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByRole('button', { name: /save profile/i }));

    expect(await screen.findByText('Server down')).toBeInTheDocument();
    expect(useAuthStore.getState().user?.firstName).toBe('Ada');
  });

  // ---- Email: request -> emailed code -> confirm ----

  it('requesting an email change sends a code and switches to the code step', async () => {
    users.requestEmailChange.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderSettings();

    await user.type(screen.getByPlaceholderText('new@example.com'), 'new@example.com');
    const passwordInputs = screen.getAllByPlaceholderText('••••••••');
    await user.type(passwordInputs[0], 'Sup3r-secret-pw');
    await user.click(emailCardFields().getByRole('button', { name: /send code/i }));

    await waitFor(() => expect(users.requestEmailChange).toHaveBeenCalledWith('new@example.com', 'Sup3r-secret-pw'));
    expect(await within(screen.getByTestId('email-section')).findByText(/we sent a 6-digit code/i)).toBeInTheDocument();
    expect(users.confirmEmailChange).not.toHaveBeenCalled();
    // Not applied yet - no session change from the request step alone.
    expect(useAuthStore.getState().token).toBe('old-token');
  });

  it('a failed email request shows a message and stays on the form', async () => {
    users.requestEmailChange.mockRejectedValue({ response: { data: { message: 'An account with this email already exists' } } });
    const user = userEvent.setup();
    renderSettings();

    await user.type(screen.getByPlaceholderText('new@example.com'), 'taken@example.com');
    await user.type(screen.getAllByPlaceholderText('••••••••')[0], 'Sup3r-secret-pw');
    await user.click(emailCardFields().getByRole('button', { name: /send code/i }));

    expect(await screen.findByText('An account with this email already exists')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('new@example.com')).toBeInTheDocument();
  });

  it('confirming the email code updates the token and user, and resets the card', async () => {
    users.requestEmailChange.mockResolvedValue(undefined);
    users.confirmEmailChange.mockResolvedValue({ token: 'new-token', userId: 1, email: 'new@example.com' } as any);
    auth.getCurrentUser.mockResolvedValue({ ...baseUser, email: 'new@example.com' });
    const user = userEvent.setup();
    renderSettings();
    await user.type(screen.getByPlaceholderText('new@example.com'), 'new@example.com');
    await user.type(screen.getAllByPlaceholderText('••••••••')[0], 'Sup3r-secret-pw');
    await user.click(emailCardFields().getByRole('button', { name: /send code/i }));
    const emailCard = within(await screen.findByTestId('email-section'));

    await user.type(emailCard.getByPlaceholderText('123456'), '482913');
    await user.click(emailCard.getByRole('button', { name: /confirm email change/i }));

    await waitFor(() => expect(users.confirmEmailChange).toHaveBeenCalledWith('482913'));
    await waitFor(() => expect(useAuthStore.getState().token).toBe('new-token'));
    expect(useAuthStore.getState().user?.email).toBe('new@example.com');
    // Back to the request form, cleared.
    expect(await screen.findByPlaceholderText('new@example.com')).toHaveValue('');
  });

  it('a wrong email code shows the server message and keeps the old session', async () => {
    users.requestEmailChange.mockResolvedValue(undefined);
    users.confirmEmailChange.mockRejectedValue({ response: { data: { message: 'This code is invalid or has expired.' } } });
    const user = userEvent.setup();
    renderSettings();
    await user.type(screen.getByPlaceholderText('new@example.com'), 'new@example.com');
    await user.type(screen.getAllByPlaceholderText('••••••••')[0], 'Sup3r-secret-pw');
    await user.click(emailCardFields().getByRole('button', { name: /send code/i }));
    const emailCard = within(await screen.findByTestId('email-section'));
    await user.type(emailCard.getByPlaceholderText('123456'), '000000');

    await user.click(emailCard.getByRole('button', { name: /confirm email change/i }));

    expect(await screen.findByText('This code is invalid or has expired.')).toBeInTheDocument();
    expect(useAuthStore.getState().token).toBe('old-token');
  });

  it('Resend on the email code step requests another code', async () => {
    users.requestEmailChange.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderSettings();
    await user.type(screen.getByPlaceholderText('new@example.com'), 'new@example.com');
    await user.type(screen.getAllByPlaceholderText('••••••••')[0], 'Sup3r-secret-pw');
    await user.click(emailCardFields().getByRole('button', { name: /send code/i }));
    const emailCard = within(await screen.findByTestId('email-section'));

    await user.click(emailCard.getByRole('button', { name: /resend code/i }));

    await waitFor(() => expect(users.requestEmailChange).toHaveBeenCalledTimes(2));
  });

  it('Cancel on the email code step goes back to the request form without confirming', async () => {
    users.requestEmailChange.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderSettings();
    await user.type(screen.getByPlaceholderText('new@example.com'), 'new@example.com');
    await user.type(screen.getAllByPlaceholderText('••••••••')[0], 'Sup3r-secret-pw');
    await user.click(emailCardFields().getByRole('button', { name: /send code/i }));
    const emailCard = within(await screen.findByTestId('email-section'));

    await user.click(emailCard.getByRole('button', { name: /cancel/i }));

    expect(await screen.findByPlaceholderText('new@example.com')).toHaveValue('');
    expect(users.confirmEmailChange).not.toHaveBeenCalled();
  });

  // ---- Password: request -> emailed code -> confirm ----

  it('requesting a password change sends a code and switches to the code step', async () => {
    users.requestPasswordChange.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderSettings();

    const [current, next, confirm] = passwordCardFields().getAllByPlaceholderText(/••••••••|At least 8 characters/);
    await user.type(current, 'Sup3r-secret-pw');
    await user.type(next, 'New-Password-123');
    await user.type(confirm, 'New-Password-123');
    await user.click(passwordCardFields().getByRole('button', { name: /send code/i }));

    await waitFor(() =>
      expect(users.requestPasswordChange).toHaveBeenCalledWith('Sup3r-secret-pw', 'New-Password-123')
    );
    expect(await passwordCardFields().findByText(/we sent a 6-digit code/i)).toBeInTheDocument();
    expect(users.confirmPasswordChange).not.toHaveBeenCalled();
  });

  it("mismatched new/confirm passwords are rejected client-side, without requesting a code", async () => {
    const user = userEvent.setup();
    renderSettings();

    const [current, next, confirm] = passwordCardFields().getAllByPlaceholderText(/••••••••|At least 8 characters/);
    await user.type(current, 'Sup3r-secret-pw');
    await user.type(next, 'New-Password-123');
    await user.type(confirm, 'Something-Else-456');
    await user.click(passwordCardFields().getByRole('button', { name: /send code/i }));

    expect(await screen.findByText(/don't match/i)).toBeInTheDocument();
    expect(users.requestPasswordChange).not.toHaveBeenCalled();
  });

  it('the wrong current password shows the server message at the request step', async () => {
    users.requestPasswordChange.mockRejectedValue({ response: { data: { message: 'Current password is incorrect' } } });
    const user = userEvent.setup();
    renderSettings();

    const [current, next, confirm] = passwordCardFields().getAllByPlaceholderText(/••••••••|At least 8 characters/);
    await user.type(current, 'wrong-one');
    await user.type(next, 'New-Password-123');
    await user.type(confirm, 'New-Password-123');
    await user.click(passwordCardFields().getByRole('button', { name: /send code/i }));

    expect(await screen.findByText('Current password is incorrect')).toBeInTheDocument();
  });

  it('confirming the password code applies the change and resets the card', async () => {
    users.requestPasswordChange.mockResolvedValue(undefined);
    users.confirmPasswordChange.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderSettings();
    const [current, next, confirm] = passwordCardFields().getAllByPlaceholderText(/••••••••|At least 8 characters/);
    await user.type(current, 'Sup3r-secret-pw');
    await user.type(next, 'New-Password-123');
    await user.type(confirm, 'New-Password-123');
    await user.click(passwordCardFields().getByRole('button', { name: /send code/i }));
    await passwordCardFields().findByText(/we sent a 6-digit code/i);

    await user.type(passwordCardFields().getByPlaceholderText('123456'), '111222');
    await user.click(passwordCardFields().getByRole('button', { name: /confirm password change/i }));

    await waitFor(() => expect(users.confirmPasswordChange).toHaveBeenCalledWith('111222'));
    // Back to the request form, cleared.
    const [currentAgain] = await waitFor(() =>
      passwordCardFields().getAllByPlaceholderText(/••••••••|At least 8 characters/)
    );
    expect(currentAgain).toHaveValue('');
  });

  it('a wrong password code shows the server message', async () => {
    users.requestPasswordChange.mockResolvedValue(undefined);
    users.confirmPasswordChange.mockRejectedValue({ response: { data: { message: 'This code is invalid or has expired.' } } });
    const user = userEvent.setup();
    renderSettings();
    const [current, next, confirm] = passwordCardFields().getAllByPlaceholderText(/••••••••|At least 8 characters/);
    await user.type(current, 'Sup3r-secret-pw');
    await user.type(next, 'New-Password-123');
    await user.type(confirm, 'New-Password-123');
    await user.click(passwordCardFields().getByRole('button', { name: /send code/i }));
    await passwordCardFields().findByText(/we sent a 6-digit code/i);
    await user.type(passwordCardFields().getByPlaceholderText('123456'), '000000');

    await user.click(passwordCardFields().getByRole('button', { name: /confirm password change/i }));

    expect(await screen.findByText('This code is invalid or has expired.')).toBeInTheDocument();
  });

  it('Cancel on the password code step goes back to the request form', async () => {
    users.requestPasswordChange.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderSettings();
    const [current, next, confirm] = passwordCardFields().getAllByPlaceholderText(/••••••••|At least 8 characters/);
    await user.type(current, 'Sup3r-secret-pw');
    await user.type(next, 'New-Password-123');
    await user.type(confirm, 'New-Password-123');
    await user.click(passwordCardFields().getByRole('button', { name: /send code/i }));
    await passwordCardFields().findByText(/we sent a 6-digit code/i);

    await user.click(passwordCardFields().getByRole('button', { name: /cancel/i }));

    const [currentAgain] = await waitFor(() =>
      passwordCardFields().getAllByPlaceholderText(/••••••••|At least 8 characters/)
    );
    expect(currentAgain).toHaveValue('');
    expect(users.confirmPasswordChange).not.toHaveBeenCalled();
  });

  it('deactivating requires confirmation, then logs out and redirects to /login', async () => {
    users.deactivateMe.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByRole('button', { name: /deactivate my account/i }));
    // Still requires an explicit confirm - not deactivated by the first click.
    expect(users.deactivateMe).not.toHaveBeenCalled();
    expect(screen.getByText(/are you sure/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /confirm/i }));

    await waitFor(() => expect(users.deactivateMe).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(useAuthStore.getState().isAuthenticated).toBe(false));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/login'));
  });

  it('cancelling the deactivate confirmation does nothing', async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByRole('button', { name: /deactivate my account/i }));
    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(users.deactivateMe).not.toHaveBeenCalled();
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });
});
