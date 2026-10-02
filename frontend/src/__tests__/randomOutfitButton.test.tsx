import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

import FlatOutfitBuilderPage from '../pages/FlatOutfitBuilderPage';
import { ToastProvider } from '../components/Toast';
import { useOutfitStore } from '../store/useOutfitStore';
import { useClothingStore } from '../store/useClothingStore';
import { useCollectionStore } from '../store/useCollectionStore';
import { useOutfitDraftStore } from '../store/useOutfitDraftStore';
import { usePersonaStore } from '../store/usePersonaStore';
import { outfitService } from '../api/outfitService';
import { clothingService } from '../api/clothingService';
import { userService } from '../api/userService';
import { ClothingCategory as C, PersonaType } from '../types';
import { makeItem } from '../test/fixtures';

// Task 87: the "Create random outfit" button on Attire.
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

const CLOSET = [
  makeItem({ itemId: 1, name: 'Linen Shirt', category: C.TOP }),
  makeItem({ itemId: 2, name: 'Blue Jeans', category: C.BOTTOM }),
  makeItem({ itemId: 3, name: 'Denim Jacket', category: C.JACKET }),
  makeItem({ itemId: 4, name: 'Runner', category: C.SHOES, side: 'left' }),
  makeItem({ itemId: 5, name: 'Runner', category: C.SHOES, side: 'right' }),
  // Wrong persona: never picked.
  makeItem({ itemId: 6, name: 'Mens Tee', category: C.TOP, personaType: PersonaType.MALE }),
];

function LocationProbe() {
  return <div data-testid="location">{useLocation().pathname}</div>;
}

function renderNewOutfit(entry = '/outfits/flat/new') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <ToastProvider>
        <LocationProbe />
        <Routes>
          <Route path="/outfits/flat/new" element={<FlatOutfitBuilderPage />} />
          <Route path="/outfits/flat/edit/:id" element={<FlatOutfitBuilderPage />} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  useOutfitStore.setState({ outfits: [], mainOutfitId: null, isLoading: false, error: null });
  useClothingStore.setState({ items: [], isLoading: false, error: null });
  useCollectionStore.setState({ collections: [], isLoading: false, error: null });
  useOutfitDraftStore.getState().clearDraft();
  usePersonaStore.getState().setPersonaType(PersonaType.FEMALE);
  vi.mocked(outfitService.getOutfits).mockResolvedValue([]);
  vi.mocked(clothingService.getClothingItems).mockResolvedValue(structuredClone(CLOSET));
  vi.mocked(userService.getMe).mockResolvedValue({ mainOutfitId: null } as never);
});

afterEach(() => vi.restoreAllMocks());

describe('Create random outfit', () => {
  it('fills the draft with a pair of shoes, a bottom and a shirt - and a jacket when the dice allow - then shows the persona', async () => {
    const user = userEvent.setup();
    // Everything picks its first option; the jacket roll (0.1 < 0.5) wears the jacket.
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    renderNewOutfit();
    await screen.findByText('Linen Shirt');

    await user.click(screen.getByRole('button', { name: /create random outfit/i }));

    expect(useOutfitDraftStore.getState().selectedItemIds.slice().sort()).toEqual([1, 2, 3, 4, 5]);
    // The persona preview is on: the panel says so and its toggle offers the way back.
    expect(await screen.findByRole('heading', { name: 'Persona Preview' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /list view/i })).toBeInTheDocument();
  });

  it('leaves the jacket out when the dice say no', async () => {
    const user = userEvent.setup();
    vi.spyOn(Math, 'random').mockReturnValue(0.9);
    renderNewOutfit();
    await screen.findByText('Linen Shirt');

    await user.click(screen.getByRole('button', { name: /create random outfit/i }));

    expect(useOutfitDraftStore.getState().selectedItemIds.slice().sort()).toEqual([1, 2, 4, 5]);
  });

  it('replaces whatever was selected, and never touches the saved outfits', async () => {
    const user = userEvent.setup();
    vi.spyOn(Math, 'random').mockReturnValue(0.9);
    useOutfitDraftStore.getState().setDraft([3], [3]);
    renderNewOutfit();
    await screen.findByText('Linen Shirt');

    await user.click(screen.getByRole('button', { name: /create random outfit/i }));

    await waitFor(() => expect(useOutfitDraftStore.getState().selectedItemIds).not.toContain(3));
    expect(useOutfitDraftStore.getState().layerOrder).toBeNull();
    expect(outfitService.createOutfit).not.toHaveBeenCalled();
    expect(outfitService.updateOutfit).not.toHaveBeenCalled();
  });

  it('says what is missing when the closet cannot make a full outfit', async () => {
    const user = userEvent.setup();
    vi.mocked(clothingService.getClothingItems).mockResolvedValue([CLOSET[0]]);
    renderNewOutfit();
    await screen.findByText('Linen Shirt');

    await user.click(screen.getByRole('button', { name: /create random outfit/i }));

    expect(await screen.findByText(/no shoes, bottom in your closet/i)).toBeInTheDocument();
    expect(useOutfitDraftStore.getState().selectedItemIds).toEqual([1]);
  });

  it('never overwrites the outfit being edited: it starts a new outfit instead', async () => {
    const user = userEvent.setup();
    vi.spyOn(Math, 'random').mockReturnValue(0.9);
    vi.mocked(outfitService.getOutfits).mockResolvedValue([
      {
        outfitId: 20,
        name: 'Office',
        avatarType: PersonaType.FEMALE,
        createdAt: '2026-09-24T00:00:00',
        items: [{ outfitItemId: 200, itemId: 1, slot: 'top', itemOrder: 0 }],
      },
    ]);
    renderNewOutfit('/outfits/flat/edit/20');
    await waitFor(() => expect(screen.getByPlaceholderText('ENTER STYLE NAME')).toHaveValue('Office'));
    expect(screen.getByRole('button', { name: /update style/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /create random outfit/i }));

    // Now on the new-outfit page: a fresh name, "Save" instead of "Update", the random pieces selected.
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/outfits/flat/new'));
    expect(screen.getByPlaceholderText('ENTER STYLE NAME')).toHaveValue('New Style');
    expect(screen.getByRole('button', { name: /save to collection/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /update style/i })).not.toBeInTheDocument();
    expect(useOutfitDraftStore.getState().selectedItemIds.slice().sort()).toEqual([1, 2, 4, 5]);
    expect(outfitService.updateOutfit).not.toHaveBeenCalled();
  });
});
