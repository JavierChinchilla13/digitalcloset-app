import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

import App from '../App';
import { ToastProvider } from '../components/Toast';
import { useAuthStore } from '../store/useAuthStore';
import { useClothingStore } from '../store/useClothingStore';
import { useOutfitStore } from '../store/useOutfitStore';
import { useCollectionStore } from '../store/useCollectionStore';
import { authService } from '../api/authService';
import { Plan } from '../types';
import { makeUser } from '../test/fixtures';

// Task 97: opening the app refreshes the signed-in account, so a plan changed by an admin (or a session
// that predates the plan fields) takes effect without signing in again - and a premium account stops
// seeing ads.
vi.mock('../api/authService', () => ({ authService: { getCurrentUser: vi.fn() } }));
vi.mock('../api/clothingService', () => ({ clothingService: { getClothingItems: vi.fn(async () => []) } }));
vi.mock('../api/outfitService', () => ({ outfitService: { getOutfits: vi.fn(async () => []) } }));
vi.mock('../api/collectionService', () => ({ collectionService: { getCollections: vi.fn(async () => []) } }));
vi.mock('../api/personaDisplayNameService', () => ({ personaDisplayNameService: { getAll: vi.fn(async () => []), upsert: vi.fn() } }));
vi.mock('../components/FittingTool/UploadFlow', () => ({ default: () => null }));

const auth = vi.mocked(authService);

function renderApp(path = '/closet') {
  window.history.pushState({}, '', path);
  return render(
    <ToastProvider>
      <App />
    </ToastProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.getState().logout();
  useClothingStore.setState({ items: [], error: null, isLoading: false });
  useOutfitStore.setState({ outfits: [], error: null, isLoading: false });
  useCollectionStore.setState({ collections: [], error: null, isLoading: false });
  vi.stubEnv('VITE_AD_PROVIDER', 'adsense');
  vi.stubEnv('VITE_ADSENSE_CLIENT', 'ca-pub-1234567890123456');
  vi.stubEnv('VITE_ADSENSE_SLOT', '1234567890');
});

afterEach(() => vi.unstubAllEnvs());

describe('account refresh on open', () => {
  it('replaces a stale copy of the account (no plan) with the server\'s', async () => {
    const stale = { ...makeUser(), plan: undefined, garmentLimit: undefined };
    useAuthStore.getState().login('kept-token', stale);
    auth.getCurrentUser.mockResolvedValue(makeUser({ plan: Plan.PREMIUM, garmentLimit: 300 }));

    renderApp();

    await waitFor(() => expect(useAuthStore.getState().user?.plan).toBe(Plan.PREMIUM));
    expect(useAuthStore.getState().user?.garmentLimit).toBe(300);
    expect(useAuthStore.getState().token).toBe('kept-token');
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('an account upgraded to premium stops seeing the ad once refreshed', async () => {
    useAuthStore.getState().login('t', makeUser());
    auth.getCurrentUser.mockResolvedValue(makeUser({ plan: Plan.PREMIUM, garmentLimit: 300 }));

    renderApp();

    expect(screen.getByTestId('ad-slot')).toBeInTheDocument(); // free until the refresh arrives
    await waitFor(() => expect(screen.queryByTestId('ad-slot')).not.toBeInTheDocument());
  });

  it('a failed refresh keeps the account as it was', async () => {
    useAuthStore.getState().login('t', makeUser());
    auth.getCurrentUser.mockRejectedValue({ isAxiosError: true, code: 'ERR_NETWORK' });

    renderApp();

    await waitFor(() => expect(auth.getCurrentUser).toHaveBeenCalled());
    expect(useAuthStore.getState().user?.plan).toBe(Plan.FREE);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('nothing is asked for a visitor who is not signed in', () => {
    renderApp('/login');
    expect(auth.getCurrentUser).not.toHaveBeenCalled();
  });
});
