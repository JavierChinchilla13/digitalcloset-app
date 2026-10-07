import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import UserMenu from '../components/UserMenu';
import Navbar from '../components/Navbar';
import SettingsPage from '../pages/SettingsPage';
import AdminUsersPage from '../pages/AdminUsersPage';
import { ToastProvider } from '../components/Toast';
import { useAuthStore } from '../store/useAuthStore';
import { useClothingStore } from '../store/useClothingStore';
import { adminService } from '../api/adminService';
import { Plan, Role } from '../types';
import { makeItems, makeUser } from '../test/fixtures';

// Task 96: where the plan and the garment space show up - the account menus, Settings - and how an
// admin gives an account the Premium plan.
vi.mock('../api/userService', () => ({ userService: {} }));
vi.mock('../api/authService', () => ({ authService: { getCurrentUser: vi.fn() } }));
vi.mock('../api/adminService', () => ({
  adminService: { getUsers: vi.fn(), deactivateUser: vi.fn(), reactivateUser: vi.fn(), createUser: vi.fn(), setPlan: vi.fn() },
}));

const admin = vi.mocked(adminService);

function setSession(user = makeUser(), count = 0) {
  useAuthStore.getState().login('token', user);
  useClothingStore.setState({ items: makeItems(count), isLoading: false, error: null });
}

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.getState().logout();
});

describe('account menus show the garment space', () => {
  it('the desktop account menu has a "7 / 15 garments" line for a free account', async () => {
    setSession(makeUser(), 7);
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <UserMenu />
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: /account menu/i }));

    expect(within(screen.getByRole('menu')).getByText('7 / 15 garments')).toBeInTheDocument();
  });

  it('the phone menu shows it too', async () => {
    setSession(makeUser(), 12);
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: /open menu/i }));

    expect(within(screen.getByRole('dialog')).getByText('12 / 15 garments')).toBeInTheDocument();
  });

  it('a premium account shows its own limit; an admin shows none', async () => {
    setSession(makeUser({ plan: Plan.PREMIUM, garmentLimit: 300 }), 40);
    const user = userEvent.setup();
    const { unmount } = render(
      <MemoryRouter>
        <UserMenu />
      </MemoryRouter>
    );
    await user.click(screen.getByRole('button', { name: /account menu/i }));
    expect(screen.getByText('40 / 300 garments')).toBeInTheDocument();
    unmount();

    setSession(makeUser({ role: Role.ROLE_ADMIN, garmentLimit: null }), 40);
    render(
      <MemoryRouter>
        <UserMenu />
      </MemoryRouter>
    );
    await user.click(screen.getByRole('button', { name: /account menu/i }));
    expect(screen.queryByTestId('storage-meter')).not.toBeInTheDocument();
  });
});

describe('Settings', () => {
  const renderSettings = () =>
    render(
      <MemoryRouter>
        <ToastProvider>
          <SettingsPage />
        </ToastProvider>
      </MemoryRouter>
    );

  it('a free account sees its plan and storage', () => {
    setSession(makeUser(), 9);
    renderSettings();

    expect(within(screen.getByTestId('plan-row')).getByText('Free')).toBeInTheDocument();
    const storage = within(screen.getByTestId('storage-row'));
    expect(storage.getByText('9 / 15 garments')).toBeInTheDocument();
    expect(storage.getByRole('progressbar', { name: /garment storage used/i })).toHaveAttribute('aria-valuenow', '9');
  });

  it('a premium account says Premium; an admin says unlimited and has no storage row', () => {
    setSession(makeUser({ plan: Plan.PREMIUM, garmentLimit: 300 }), 9);
    const { unmount } = renderSettings();
    expect(within(screen.getByTestId('plan-row')).getByText('Premium')).toBeInTheDocument();
    unmount();

    setSession(makeUser({ role: Role.ROLE_ADMIN, garmentLimit: null }), 9);
    renderSettings();
    expect(within(screen.getByTestId('plan-row')).getByText(/unlimited space/i)).toBeInTheDocument();
    expect(screen.queryByTestId('storage-row')).not.toBeInTheDocument();
  });
});

describe('Admin: plans', () => {
  const ADMIN = makeUser({ userId: 1, email: 'admin@example.com', role: Role.ROLE_ADMIN, garmentLimit: null });
  const SHOPPER = makeUser({ userId: 2, email: 'shopper@example.com' });

  const renderAdmin = () =>
    render(
      <MemoryRouter>
        <ToastProvider>
          <AdminUsersPage />
        </ToastProvider>
      </MemoryRouter>
    );

  beforeEach(() => {
    setSession(ADMIN);
    admin.getUsers.mockResolvedValue([ADMIN, SHOPPER]);
  });

  it('shows each normal account\'s plan, and "unlimited" for an admin', async () => {
    renderAdmin();

    expect(await screen.findByRole('combobox', { name: /plan for shopper@example.com/i })).toHaveValue(Plan.FREE);
    expect(screen.getByText(/unlimited space/i)).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: /plan for admin@example.com/i })).not.toBeInTheDocument();
  });

  it('choosing Premium saves it and says so', async () => {
    admin.setPlan.mockResolvedValue({ ...SHOPPER, plan: Plan.PREMIUM, garmentLimit: 300 });
    const user = userEvent.setup();
    renderAdmin();

    await user.selectOptions(await screen.findByRole('combobox', { name: /plan for shopper@example.com/i }), Plan.PREMIUM);

    expect(admin.setPlan).toHaveBeenCalledWith(2, Plan.PREMIUM);
    expect(await screen.findByText('shopper@example.com is now on the Premium plan')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /plan for shopper@example.com/i })).toHaveValue(Plan.PREMIUM);
  });

  it('a failed change is reported and the old plan stays', async () => {
    admin.setPlan.mockRejectedValue({ response: { status: 403, data: { message: 'You do not have permission to do this' } } });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const user = userEvent.setup();
    renderAdmin();

    await user.selectOptions(await screen.findByRole('combobox', { name: /plan for shopper@example.com/i }), Plan.PREMIUM);

    expect(await screen.findByText('You do not have permission to do this')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('combobox', { name: /plan for shopper@example.com/i })).toHaveValue(Plan.FREE));
  });
});
