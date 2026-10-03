import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

import Navbar from '../components/Navbar';
import { useAuthStore } from '../store/useAuthStore';
import { Role } from '../types';

// Task 91: on a phone the signed-in navbar shows a menu button that opens a
// full-screen sheet with every page. (jsdom ignores CSS, so the desktop links
// are in the DOM too - the sheet is found by its dialog role.)
const user = (role: Role) => ({
  userId: 1,
  email: 'me@example.com',
  role,
  active: true,
  createdAt: '2026-01-01T00:00:00',
});

function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>;
}

function renderNav(entry = '/showcase') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Navbar />
      <Where />
      <Routes>
        <Route path="*" element={<div />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  useAuthStore.getState().logout();
  document.body.style.overflow = '';
});

describe('phone menu', () => {
  it('signed-out visitors have no menu button (Login / Join fit in the bar)', () => {
    renderNav('/');
    expect(screen.queryByRole('button', { name: /open menu/i })).not.toBeInTheDocument();
  });

  it('opens with every page a signed-in user needs, and no Admin for a normal user', async () => {
    useAuthStore.getState().login('t', user(Role.ROLE_USER) as never);
    const u = userEvent.setup();
    renderNav();

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: /open menu/i }));

    const menu = await screen.findByRole('dialog', { name: /menu/i });
    for (const name of ['Showcase', 'Attire', 'Closet', 'Outfits', 'Categories', 'Persona', 'Settings']) {
      expect(within(menu).getByRole('link', { name })).toBeInTheDocument();
    }
    expect(within(menu).queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument();
    expect(within(menu).getByText('me@example.com')).toBeInTheDocument();
    expect(within(menu).getByRole('button', { name: /log out/i })).toBeInTheDocument();
  });

  it('an admin also sees Admin', async () => {
    useAuthStore.getState().login('t', user(Role.ROLE_ADMIN) as never);
    const u = userEvent.setup();
    renderNav();
    await u.click(screen.getByRole('button', { name: /open menu/i }));

    expect(within(await screen.findByRole('dialog')).getByRole('link', { name: 'Admin' })).toHaveAttribute('href', '/admin');
  });

  it('picking a page navigates and closes the sheet', async () => {
    useAuthStore.getState().login('t', user(Role.ROLE_USER) as never);
    const u = userEvent.setup();
    renderNav();
    await u.click(screen.getByRole('button', { name: /open menu/i }));

    await u.click(within(await screen.findByRole('dialog')).getByRole('link', { name: 'Closet' }));

    expect(screen.getByTestId('where')).toHaveTextContent('/closet');
    await waitForClosed();
  });

  it('the X and Escape close it, and the page behind stops scrolling while it is open', async () => {
    useAuthStore.getState().login('t', user(Role.ROLE_USER) as never);
    const u = userEvent.setup();
    renderNav();

    await u.click(screen.getByRole('button', { name: /open menu/i }));
    expect(document.body.style.overflow).toBe('hidden');
    await u.click(screen.getByRole('button', { name: /close menu/i }));
    await waitForClosed();
    expect(document.body.style.overflow).toBe('');

    await u.click(screen.getByRole('button', { name: /open menu/i }));
    await u.keyboard('{Escape}');
    await waitForClosed();
  });

  it('Log out signs the user out', async () => {
    useAuthStore.getState().login('t', user(Role.ROLE_USER) as never);
    const u = userEvent.setup();
    renderNav();
    await u.click(screen.getByRole('button', { name: /open menu/i }));

    await u.click(within(await screen.findByRole('dialog')).getByRole('button', { name: /log out/i }));

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});

// The sheet fades out (framer-motion exit), so it leaves the DOM a moment later.
const waitForClosed = () =>
  import('@testing-library/react').then(({ waitFor }) =>
    waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  );
