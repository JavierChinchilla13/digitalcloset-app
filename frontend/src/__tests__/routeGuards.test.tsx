import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import App from '../App';
import { ToastProvider } from '../components/Toast';
import { useAuthStore } from '../store/useAuthStore';
import { useClothingStore } from '../store/useClothingStore';
import { useOutfitStore } from '../store/useOutfitStore';
import { useCollectionStore } from '../store/useCollectionStore';
import { adminService } from '../api/adminService';
import { Role } from '../types';
import type { User } from '../types';

// The whole App runs (router, layout, navbar, guards); only the network edge
// and the two heavy Fabric/AI pieces are replaced. Task 21/22 route rules.
vi.mock('../api/adminService', () => ({
  adminService: { getUsers: vi.fn(), deactivateUser: vi.fn(), reactivateUser: vi.fn() },
}));
vi.mock('../api/clothingService', () => ({
  clothingService: { getClothingItems: vi.fn(async () => []) },
}));
vi.mock('../api/outfitService', () => ({
  outfitService: { getOutfits: vi.fn(async () => []) },
}));
vi.mock('../api/collectionService', () => ({
  collectionService: { getCollections: vi.fn(async () => []) },
}));
vi.mock('../components/FittingTool/UploadFlow', () => ({ default: () => null }));

const user = (role: Role): User => ({
  userId: role === Role.ROLE_ADMIN ? 1 : 2,
  email: role === Role.ROLE_ADMIN ? 'admin@example.com' : 'user@example.com',
  role,
  active: true,
  createdAt: '2026-01-01T00:00:00',
});

function signIn(role: Role) {
  useAuthStore.getState().login('test-token', user(role));
}

function renderAt(path: string) {
  window.history.pushState({}, '', path);
  return render(
    <ToastProvider>
      <App />
    </ToastProvider>
  );
}

describe('route guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().logout();
    useClothingStore.setState({ items: [], error: null, isLoading: false });
    useOutfitStore.setState({ outfits: [], error: null, isLoading: false });
    useCollectionStore.setState({ collections: [], error: null, isLoading: false });
    vi.mocked(adminService.getUsers).mockResolvedValue([user(Role.ROLE_ADMIN), user(Role.ROLE_USER)]);
  });

  it('a signed-out visitor is sent to /login from protected pages', () => {
    for (const path of ['/closet', '/outfits', '/categories', '/admin']) {
      const { unmount } = renderAt(path);
      expect(window.location.pathname, `${path} should redirect`).toBe('/login');
      unmount();
    }
  });

  it('a signed-in normal user can open a protected page', async () => {
    signIn(Role.ROLE_USER);

    renderAt('/closet');

    expect(window.location.pathname).toBe('/closet');
    expect(await screen.findByText('WARDROBE')).toBeInTheDocument();
  });

  it('a signed-in normal user is bounced from /admin to home', () => {
    signIn(Role.ROLE_USER);

    renderAt('/admin');

    expect(window.location.pathname).toBe('/');
    expect(screen.queryByText('ACCOUNTS')).not.toBeInTheDocument();
    expect(adminService.getUsers).not.toHaveBeenCalled();
  });

  it('an admin can open /admin and sees the accounts', async () => {
    signIn(Role.ROLE_ADMIN);

    renderAt('/admin');

    expect(window.location.pathname).toBe('/admin');
    expect(await screen.findByText('user@example.com')).toBeInTheDocument();
    expect(adminService.getUsers).toHaveBeenCalledTimes(1);
  });

  it('the navbar shows the admin link only to admins', () => {
    signIn(Role.ROLE_USER);
    const normal = renderAt('/closet');
    expect(normal.container.querySelector('a[href="/admin"]')).toBeNull();
    normal.unmount();

    useAuthStore.getState().logout();
    signIn(Role.ROLE_ADMIN);
    const admin = renderAt('/closet');
    expect(admin.container.querySelector('a[href="/admin"]')).not.toBeNull();
  });

  it('an unknown URL shows the 404 page', () => {
    renderAt('/definitely/not/a/page');

    expect(screen.getByText('PAGE NOT FOUND', { exact: false })).toBeInTheDocument();
  });

  it('a failed admin load shows a retry state, not a blank page', async () => {
    signIn(Role.ROLE_ADMIN);
    vi.mocked(adminService.getUsers).mockRejectedValueOnce(new Error('403'));

    renderAt('/admin');

    expect(await screen.findByText("We couldn't load the accounts")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });
});
