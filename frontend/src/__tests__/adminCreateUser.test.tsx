import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import AdminUsersPage from '../pages/AdminUsersPage';
import { ToastProvider } from '../components/Toast';
import { useAuthStore } from '../store/useAuthStore';
import { adminService } from '../api/adminService';
import { Role } from '../types';
import type { User } from '../types';

vi.mock('../api/adminService', () => ({
  adminService: { getUsers: vi.fn(), deactivateUser: vi.fn(), reactivateUser: vi.fn(), createUser: vi.fn() },
}));

const admin = vi.mocked(adminService);

const ADMIN_SELF: User = {
  userId: 1,
  email: 'admin@example.com',
  role: Role.ROLE_ADMIN,
  active: true,
  createdAt: '2026-01-01T00:00:00',
};

function renderPage() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <AdminUsersPage />
      </ToastProvider>
    </MemoryRouter>
  );
}

// Task 79: only admins reach this page at all (route guard, tested
// elsewhere); here, an admin can create either a normal user or another
// admin - the role picker is the whole "only admins can create admins"
// control from the UI's point of view.
describe('Admin: Create User', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().login('token', ADMIN_SELF);
    admin.getUsers.mockResolvedValue([ADMIN_SELF]);
  });

  it('creating a normal user sends ROLE_USER and adds it to the list', async () => {
    const created: User = { ...ADMIN_SELF, userId: 2, email: 'new@example.com', role: Role.ROLE_USER, firstName: 'New' };
    admin.createUser.mockResolvedValue(created);
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('admin@example.com');

    await user.click(screen.getByRole('button', { name: /create user/i }));
    await user.type(screen.getByPlaceholderText('First name'), 'New');
    await user.type(screen.getByPlaceholderText('Email address'), 'new@example.com');
    await user.type(screen.getByPlaceholderText(/password/i), 'Sup3r-secret-pw');
    // "User" is the default selection - confirm it's already active.
    expect(screen.getByRole('button', { name: /^user$/i })).toHaveClass('border-accent');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() =>
      expect(admin.createUser).toHaveBeenCalledWith({
        email: 'new@example.com',
        password: 'Sup3r-secret-pw',
        firstName: 'New',
        lastName: undefined,
        role: Role.ROLE_USER,
      })
    );
    expect(await screen.findByText('new@example.com')).toBeInTheDocument();
  });

  it('picking Admin sends ROLE_ADMIN', async () => {
    admin.createUser.mockResolvedValue({ ...ADMIN_SELF, userId: 3, email: 'newadmin@example.com' });
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('admin@example.com');

    await user.click(screen.getByRole('button', { name: /create user/i }));
    await user.type(screen.getByPlaceholderText('Email address'), 'newadmin@example.com');
    await user.type(screen.getByPlaceholderText(/password/i), 'Sup3r-secret-pw');
    await user.click(screen.getByRole('button', { name: /^admin$/i }));
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() =>
      expect(admin.createUser).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'newadmin@example.com', role: Role.ROLE_ADMIN })
      )
    );
  });

  it('a duplicate email shows the server message inline and keeps the modal open', async () => {
    admin.createUser.mockRejectedValue({ response: { data: { message: 'An account with this email already exists' } } });
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('admin@example.com');

    await user.click(screen.getByRole('button', { name: /create user/i }));
    await user.type(screen.getByPlaceholderText('Email address'), 'admin@example.com');
    await user.type(screen.getByPlaceholderText(/password/i), 'Sup3r-secret-pw');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByText('An account with this email already exists')).toBeInTheDocument();
    // Still open, still just the one existing account.
    expect(screen.getByPlaceholderText('Email address')).toBeInTheDocument();
    expect(screen.getAllByText('admin@example.com')).toHaveLength(1);
  });

  it('Cancel closes the modal without creating anything', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('admin@example.com');

    await user.click(screen.getByRole('button', { name: /create user/i }));
    await user.click(screen.getByRole('button', { name: /cancel/i }));

    // AnimatePresence keeps the modal mounted through its exit animation.
    await waitFor(() => expect(screen.queryByPlaceholderText('Email address')).not.toBeInTheDocument());
    expect(admin.createUser).not.toHaveBeenCalled();
  });
});
