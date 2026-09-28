import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

import OutfitShowcasePage from '../pages/OutfitShowcasePage';
import FlatOutfitBuilderPage from '../pages/FlatOutfitBuilderPage';
import OutfitCard from '../components/OutfitCard';
import { ToastProvider } from '../components/Toast';
import { useOutfitStore } from '../store/useOutfitStore';
import { useClothingStore } from '../store/useClothingStore';
import { useCollectionStore } from '../store/useCollectionStore';
import { useOutfitDraftStore } from '../store/useOutfitDraftStore';
import { usePersonaStore } from '../store/usePersonaStore';
import { outfitService } from '../api/outfitService';
import { clothingService } from '../api/clothingService';
import { userService } from '../api/userService';
import { ClothingCategory, PersonaType } from '../types';
import type { Outfit, User } from '../types';
import { makeItem } from '../test/fixtures';

vi.mock('../api/userService', () => ({
  userService: { getMe: vi.fn(), setMainOutfit: vi.fn(), clearMainOutfit: vi.fn() },
}));
vi.mock('../api/outfitService', () => ({
  outfitService: { getOutfits: vi.fn(), createOutfit: vi.fn(), updateOutfit: vi.fn(), deleteOutfit: vi.fn() },
}));
vi.mock('../api/clothingService', () => ({
  clothingService: { getClothingItems: vi.fn(), updateClothingItem: vi.fn(), deleteClothingItem: vi.fn() },
}));
vi.mock('../api/collectionService', () => ({ collectionService: { getCollections: vi.fn(async () => []) } }));
vi.mock('../api/personaDisplayNameService', () => ({
  personaDisplayNameService: { getAll: vi.fn(async () => []), upsert: vi.fn(), reset: vi.fn() },
}));

const users = vi.mocked(userService);
const outfitsApi = vi.mocked(outfitService);
const clothingApi = vi.mocked(clothingService);

const SHIRT = makeItem({ itemId: 1, name: 'Linen Shirt', category: ClothingCategory.TOP });
const JEANS = makeItem({ itemId: 2, name: 'Blue Jeans', category: ClothingCategory.BOTTOM });

const outfit = (id: number, name: string, itemIds: number[]): Outfit => ({
  outfitId: id,
  name,
  avatarType: PersonaType.FEMALE,
  createdAt: '2026-09-24T00:00:00',
  items: itemIds.map((itemId, i) => ({
    outfitItemId: id * 10 + i,
    itemId,
    slot: itemId === 1 ? 'top' : 'bottom',
    itemOrder: i,
  })),
});

const OUTFITS = [outfit(10, 'Weekend', [1]), outfit(11, 'Office', [1, 2]), outfit(12, 'Evening', [2])];

const me = (mainOutfitId: number | null): User => ({
  userId: 1,
  email: 'me@example.com',
  role: 'ROLE_USER' as User['role'],
  active: true,
  createdAt: '2026-01-01T00:00:00',
  mainOutfitId,
});

// Shows where the router ended up, so navigation can be asserted.
function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function resetStores() {
  useOutfitStore.setState({ outfits: [], mainOutfitId: null, isLoading: false, error: null });
  useClothingStore.setState({ items: [], isLoading: false, error: null });
  useCollectionStore.setState({ collections: [], isLoading: false, error: null });
  useOutfitDraftStore.getState().clearDraft();
  usePersonaStore.getState().setPersonaType(PersonaType.FEMALE);
}

beforeEach(() => {
  vi.clearAllMocks();
  resetStores();
  outfitsApi.getOutfits.mockResolvedValue(structuredClone(OUTFITS));
  clothingApi.getClothingItems.mockResolvedValue([SHIRT, JEANS]);
  users.getMe.mockResolvedValue(me(11));
  users.setMainOutfit.mockResolvedValue(me(12));
});

describe('main outfit store', () => {
  it('fetchMainOutfit reads it off the account', async () => {
    await useOutfitStore.getState().fetchMainOutfit();

    expect(useOutfitStore.getState().mainOutfitId).toBe(11);
  });

  it('fetchMainOutfit treats "none" as null and swallows a failure', async () => {
    users.getMe.mockResolvedValueOnce(me(null));
    await useOutfitStore.getState().fetchMainOutfit();
    expect(useOutfitStore.getState().mainOutfitId).toBeNull();

    vi.spyOn(console, 'error').mockImplementation(() => {});
    users.getMe.mockRejectedValueOnce(new Error('down'));
    await expect(useOutfitStore.getState().fetchMainOutfit()).resolves.toBeUndefined();
    expect(useOutfitStore.getState().error).toBeNull();
  });

  it('setMainOutfit switches at once and calls the account endpoint', async () => {
    useOutfitStore.setState({ mainOutfitId: 10 });

    const pending = useOutfitStore.getState().setMainOutfit(12);
    expect(useOutfitStore.getState().mainOutfitId).toBe(12);
    await pending;

    expect(users.setMainOutfit).toHaveBeenCalledWith(12);
    expect(useOutfitStore.getState().mainOutfitId).toBe(12);
  });

  it('setMainOutfit puts the old one back and rejects when the server refuses', async () => {
    useOutfitStore.setState({ mainOutfitId: 10 });
    users.setMainOutfit.mockRejectedValue(new Error('403'));

    await expect(useOutfitStore.getState().setMainOutfit(12)).rejects.toThrow('403');

    expect(useOutfitStore.getState().mainOutfitId).toBe(10);
  });

  it('removing the main outfit clears it; removing another leaves it', async () => {
    outfitsApi.deleteOutfit.mockResolvedValue(undefined);
    useOutfitStore.setState({ outfits: structuredClone(OUTFITS), mainOutfitId: 11 });

    await useOutfitStore.getState().removeOutfit(12);
    expect(useOutfitStore.getState().mainOutfitId).toBe(11);

    await useOutfitStore.getState().removeOutfit(11);
    expect(useOutfitStore.getState().mainOutfitId).toBeNull();
  });

  it('saving an outfit re-reads the main outfit (the backend makes the first one main)', async () => {
    outfitsApi.createOutfit.mockResolvedValue(outfit(20, 'First', [1]));
    users.getMe.mockResolvedValue(me(20));

    await useOutfitStore.getState().saveOutfit({ name: 'First', avatarType: PersonaType.FEMALE, items: [] });

    await waitFor(() => expect(useOutfitStore.getState().mainOutfitId).toBe(20));
  });
});

describe('Showcase (landing) and the main outfit', () => {
  function renderShowcase() {
    return render(
      <MemoryRouter initialEntries={['/showcase']}>
        <ToastProvider>
          <Routes>
            <Route path="/showcase" element={<OutfitShowcasePage />} />
            <Route path="*" element={<LocationProbe />} />
          </Routes>
        </ToastProvider>
      </MemoryRouter>
    );
  }

  it('opens on the main outfit, not the first one, and tags it', async () => {
    renderShowcase();

    // "Office" (id 11) is main and second in the list.
    expect(await screen.findByRole('heading', { level: 1, name: 'Office' })).toBeInTheDocument();
    expect(screen.getByTestId('main-outfit-tag')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /set as main outfit/i })).not.toBeInTheDocument();
  });

  it('falls back to the first outfit when there is no main outfit', async () => {
    users.getMe.mockResolvedValue(me(null));

    renderShowcase();

    expect(await screen.findByRole('heading', { level: 1, name: 'Weekend' })).toBeInTheDocument();
    expect(screen.queryByTestId('main-outfit-tag')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /set as main outfit/i })).toBeInTheDocument();
  });

  it('another outfit can be chosen as main while browsing', async () => {
    const user = userEvent.setup();
    renderShowcase();
    await screen.findByRole('heading', { level: 1, name: 'Office' });

    await user.click(screen.getByTitle('Next outfit'));
    await screen.findByRole('heading', { level: 1, name: 'Evening' });
    expect(screen.queryByTestId('main-outfit-tag')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /set as main outfit/i }));

    await waitFor(() => expect(users.setMainOutfit).toHaveBeenCalledWith(12));
    expect(await screen.findByTestId('main-outfit-tag')).toBeInTheDocument();
    expect(useOutfitStore.getState().mainOutfitId).toBe(12);
  });

  it('says so and keeps the old main outfit when setting it fails', async () => {
    users.setMainOutfit.mockRejectedValue(new Error('500'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const user = userEvent.setup();
    renderShowcase();
    await screen.findByRole('heading', { level: 1, name: 'Office' });
    await user.click(screen.getByTitle('Next outfit'));
    await screen.findByRole('heading', { level: 1, name: 'Evening' });

    await user.click(screen.getByRole('button', { name: /set as main outfit/i }));

    expect(await screen.findByText("Couldn't set your main outfit")).toBeInTheDocument();
    expect(useOutfitStore.getState().mainOutfitId).toBe(11);
  });

  it('"Edit outfit" opens the outfit being shown in Attire', async () => {
    const user = userEvent.setup();
    renderShowcase();
    await screen.findByRole('heading', { level: 1, name: 'Office' });

    await user.click(screen.getByRole('button', { name: /edit outfit/i }));

    expect(await screen.findByTestId('location')).toHaveTextContent('/outfits/flat/edit/11');
  });
});

describe('Attire and the main outfit', () => {
  function renderAttire(entry: string | { pathname: string; state?: unknown } = '/') {
    return render(
      <MemoryRouter initialEntries={[entry]}>
        <ToastProvider>
          <LocationProbe />
          <Routes>
            <Route path="/" element={<FlatOutfitBuilderPage />} />
            <Route path="/outfits/flat/new" element={<FlatOutfitBuilderPage />} />
            <Route path="/outfits/flat/edit/:id" element={<FlatOutfitBuilderPage />} />
          </Routes>
        </ToastProvider>
      </MemoryRouter>
    );
  }

  it('at "/" opens the main outfit for editing', async () => {
    renderAttire('/');

    await waitFor(() => expect(screen.getByPlaceholderText('ENTER STYLE NAME')).toHaveValue('Office'));
    await waitFor(() => expect(useOutfitDraftStore.getState().selectedItemIds).toEqual([1, 2]));
    expect(screen.getByRole('button', { name: /update style/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /new outfit/i })).toBeInTheDocument();
  });

  it('with no main outfit, "/" is a fresh new-outfit page as before', async () => {
    users.getMe.mockResolvedValue(me(null));

    renderAttire('/');

    await screen.findByText('Linen Shirt');
    expect(screen.getByPlaceholderText('ENTER STYLE NAME')).toHaveValue('New Style');
    expect(screen.getByRole('button', { name: /save to collection/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /new outfit/i })).not.toBeInTheDocument();
  });

  it('a main outfit that no longer exists is ignored', async () => {
    users.getMe.mockResolvedValue(me(999));

    renderAttire('/');

    await screen.findByText('Linen Shirt');
    expect(screen.getByRole('button', { name: /save to collection/i })).toBeInTheDocument();
  });

  it('"New outfit" empties the page and goes to the new-outfit route, not back to the main outfit', async () => {
    const user = userEvent.setup();
    renderAttire('/');
    await waitFor(() => expect(screen.getByPlaceholderText('ENTER STYLE NAME')).toHaveValue('Office'));

    await user.click(screen.getByRole('button', { name: /new outfit/i }));

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/outfits/flat/new'));
    expect(screen.getByPlaceholderText('ENTER STYLE NAME')).toHaveValue('New Style');
    expect(useOutfitDraftStore.getState().selectedItemIds).toEqual([]);
    expect(screen.getByRole('button', { name: /save to collection/i })).toBeInTheDocument();
  });

  it('saving while editing the main outfit updates it instead of creating another', async () => {
    outfitsApi.updateOutfit.mockResolvedValue(outfit(11, 'Office', [1, 2]));
    const user = userEvent.setup();
    renderAttire('/');
    await waitFor(() => expect(useOutfitDraftStore.getState().selectedItemIds).toEqual([1, 2]));

    await user.click(screen.getByRole('button', { name: /update style/i }));

    await waitFor(() => expect(outfitsApi.updateOutfit).toHaveBeenCalledTimes(1));
    expect(outfitsApi.updateOutfit.mock.calls[0][0]).toBe(11);
    expect(outfitsApi.createOutfit).not.toHaveBeenCalled();
  });

  it('WEAR STYLE keeps its own draft instead of loading the main outfit over it', async () => {
    useOutfitDraftStore.getState().setDraft([2]);

    renderAttire({ pathname: '/', state: { showPersonaPreview: true } });

    await screen.findByText('Linen Shirt');
    expect(screen.getByPlaceholderText('ENTER STYLE NAME')).toHaveValue('New Style');
    expect(useOutfitDraftStore.getState().selectedItemIds).toEqual([2]);
    expect(screen.getByRole('button', { name: /save to collection/i })).toBeInTheDocument();
  });

  it('the explicit edit route still edits that outfit, main or not', async () => {
    renderAttire('/outfits/flat/edit/12');

    await waitFor(() => expect(screen.getByPlaceholderText('ENTER STYLE NAME')).toHaveValue('Evening'));
    expect(screen.getByRole('button', { name: /update style/i })).toBeInTheDocument();
  });
});

describe('Saved outfit cards', () => {
  function renderCard(o: Outfit) {
    return render(
      <MemoryRouter>
        <ToastProvider>
          <OutfitCard outfit={o} />
        </ToastProvider>
      </MemoryRouter>
    );
  }

  beforeEach(() => {
    useClothingStore.setState({ items: [SHIRT, JEANS] });
  });

  it('the main outfit is tagged and its star is already on', () => {
    useOutfitStore.setState({ mainOutfitId: 11 });

    renderCard(OUTFITS[1]);

    expect(screen.getByTestId('main-outfit-tag')).toBeInTheDocument();
    const starBtn = screen.getAllByTitle(/your main outfit is the one shown first on showcase/i).find((el) => el.tagName === 'BUTTON');
    expect(starBtn).toBeDisabled();
  });

  it('another outfit has no tag and can be made main', async () => {
    useOutfitStore.setState({ mainOutfitId: 11 });
    users.setMainOutfit.mockResolvedValue(me(10));
    const user = userEvent.setup();

    renderCard(OUTFITS[0]);
    expect(screen.queryByTestId('main-outfit-tag')).not.toBeInTheDocument();
    await user.click(screen.getByTitle(/set as main outfit -/i));

    await waitFor(() => expect(users.setMainOutfit).toHaveBeenCalledWith(10));
    expect(useOutfitStore.getState().mainOutfitId).toBe(10);
  });
});
