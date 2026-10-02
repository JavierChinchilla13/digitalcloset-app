import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import UserMenu from '../components/UserMenu';
import { useAuthStore } from '../store/useAuthStore';
import { Role } from '../types';
import type { User } from '../types';

const makeUser = (role: Role): User => ({
  userId: 1,
  email: 'shopper@example.com',
  role,
  active: true,
  createdAt: '2026-01-01T00:00:00',
});

function renderMenu() {
  return render(
    <MemoryRouter>
      <UserMenu />
    </MemoryRouter>
  );
}

// Task 79: Persona/Categories/Admin/Settings/Logout/Theme used to be
// separate always-visible navbar icons; they now live in one dropdown off
// the user avatar, opened by hover or click.
describe('UserMenu', () => {
  beforeEach(() => {
    useAuthStore.getState().login('token', makeUser(Role.ROLE_USER));
  });

  it('is closed until opened', () => {
    renderMenu();

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('opens on click and lists Theme, Persona, Categories, Settings and Logout', async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByRole('button', { name: /account menu/i }));

    const menu = screen.getByRole('menu');
    expect(menu).toBeInTheDocument();
    expect(screen.getByText('Theme')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /persona/i })).toHaveAttribute('href', '/persona');
    expect(screen.getByRole('link', { name: /categories/i })).toHaveAttribute('href', '/categories');
    expect(screen.getByRole('link', { name: /settings/i })).toHaveAttribute('href', '/settings');
    expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument();
  });

  it('opens on hover too', async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.hover(screen.getByRole('button', { name: /account menu/i }));

    await waitFor(() => expect(screen.getByRole('menu')).toBeInTheDocument());
  });

  it('shows Admin only for an admin', async () => {
    const user = userEvent.setup();
    const { rerender } = renderMenu();
    await user.click(screen.getByRole('button', { name: /account menu/i }));
    expect(screen.queryByRole('link', { name: /admin/i })).not.toBeInTheDocument();

    useAuthStore.getState().login('token', makeUser(Role.ROLE_ADMIN));
    rerender(
      <MemoryRouter>
        <UserMenu />
      </MemoryRouter>
    );
    await user.click(screen.getByRole('button', { name: /account menu/i }));
    expect(screen.getByRole('link', { name: /admin/i })).toHaveAttribute('href', '/admin');
  });

  it('closes when clicking a link', async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole('button', { name: /account menu/i }));

    await user.click(screen.getByRole('link', { name: /settings/i }));

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes on an outside click', async () => {
    // In a real browser this full-viewport overlay sits on top and is what
    // actually receives a click anywhere else on the page; jsdom doesn't do
    // hit-testing, so the test targets the overlay directly - see the
    // data-testid's comment in UserMenu.tsx.
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole('button', { name: /account menu/i }));
    expect(screen.getByRole('menu')).toBeInTheDocument();

    await user.click(screen.getByTestId('user-menu-overlay'));

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('logout calls the store and closes the menu', async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole('button', { name: /account menu/i }));

    await user.click(screen.getByRole('button', { name: /logout/i }));

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
