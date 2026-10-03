import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

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

// Task 92: on a phone the builder is two screens, "Closet" and "Outfit". (jsdom ignores
// CSS, so what is checked is which tab is selected and which panel carries `hidden`.)
vi.mock('../api/userService', () => ({
  userService: { getMe: vi.fn(), setMainOutfit: vi.fn() },
}));
vi.mock('../api/outfitService', () => ({
  outfitService: { getOutfits: vi.fn(), createOutfit: vi.fn(), updateOutfit: vi.fn(), deleteOutfit: vi.fn() },
}));
vi.mock('../api/clothingService', () => ({
  clothingService: { getClothingItems: vi.fn(), updateClothingItem: vi.fn(), deleteClothingItem: vi.fn() },
}));
vi.mock('../api/collectionService', () => ({ collectionService: { getCollections: vi.fn(async () => []) } }));
vi.mock('../api/personaDisplayNameService', () => ({
  personaDisplayNameService: { getAll: vi.fn(async () => []), upsert: vi.fn() },
}));

const CLOSET = [
  makeItem({ itemId: 1, name: 'Linen Shirt', category: C.TOP }),
  makeItem({ itemId: 2, name: 'Blue Jeans', category: C.BOTTOM }),
  makeItem({ itemId: 4, name: 'Runner', category: C.SHOES, side: 'left' }),
  makeItem({ itemId: 5, name: 'Runner', category: C.SHOES, side: 'right' }),
];

// The builder asks (min-width: 1024px) whether it is on a wide screen; tests pick one.
const realMatchMedia = window.matchMedia;
function setViewport(wide: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: query.includes('min-width: 1024px') ? wide : false,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}

const closetPanel = () => document.querySelector('aside') as HTMLElement;
const outfitPanel = () => document.querySelector('main') as HTMLElement;
const isShown = (el: HTMLElement) => !el.className.split(' ').includes('hidden');

function renderBuilder() {
  return render(
    <MemoryRouter initialEntries={['/outfits/flat/new']}>
      <ToastProvider>
        <Routes>
          <Route path="/outfits/flat/new" element={<FlatOutfitBuilderPage />} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>
  );
}

afterEach(() => {
  window.matchMedia = realMatchMedia;
});

beforeEach(() => {
  setViewport(false); // a phone, unless a test says otherwise
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

describe('builder on a phone', () => {
  it('opens on the Closet tab, with the outfit panel tucked away', async () => {
    renderBuilder();
    await screen.findByText('Linen Shirt');

    expect(screen.getByRole('tab', { name: 'Closet' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /^Outfit \(0\)/ })).toHaveAttribute('aria-selected', 'false');
    expect(isShown(closetPanel())).toBe(true);
    expect(isShown(outfitPanel())).toBe(false);
  });

  it('picking a piece keeps you in the Closet, counts it on the Outfit tab, and offers "View outfit"', async () => {
    const user = userEvent.setup();
    renderBuilder();
    await user.click(await screen.findByText('Linen Shirt'));

    expect(screen.getByRole('tab', { name: 'Outfit (1)' })).toBeInTheDocument();
    expect(isShown(closetPanel())).toBe(true);

    await user.click(screen.getByRole('button', { name: /view outfit \(1\)/i }));

    expect(screen.getByRole('tab', { name: /^Outfit/ })).toHaveAttribute('aria-selected', 'true');
    expect(isShown(outfitPanel())).toBe(true);
    expect(isShown(closetPanel())).toBe(false);
  });

  it('the tabs switch both ways', async () => {
    const user = userEvent.setup();
    renderBuilder();
    await screen.findByText('Linen Shirt');

    await user.click(screen.getByRole('tab', { name: /^Outfit/ }));
    expect(isShown(outfitPanel())).toBe(true);
    await user.click(screen.getByRole('tab', { name: 'Closet' }));
    expect(isShown(closetPanel())).toBe(true);
    expect(isShown(outfitPanel())).toBe(false);
  });

  it('"Create random outfit" jumps to the outfit it made', async () => {
    const user = userEvent.setup();
    vi.spyOn(Math, 'random').mockReturnValue(0.9);
    renderBuilder();
    await screen.findByText('Linen Shirt');

    await user.click(screen.getByRole('button', { name: /create random outfit/i }));

    expect(screen.getByRole('tab', { name: /^Outfit/ })).toHaveAttribute('aria-selected', 'true');
    expect(isShown(outfitPanel())).toBe(true);
  });
});

describe('builder on a phone - what you have picked stays in view', () => {
  it('the Closet tab docks a mini preview, the pieces as thumbnails and the way to the outfit', async () => {
    const user = userEvent.setup();
    renderBuilder();
    expect(screen.queryByLabelText('Selected pieces')).not.toBeInTheDocument();

    await user.click(await screen.findByText('Linen Shirt'));
    await user.click(await screen.findByText('Blue Jeans'));

    const dock = screen.getByLabelText('Selected pieces');
    expect(within(dock).getAllByRole('img').map((img) => img.getAttribute('aria-label'))).toEqual(['Linen Shirt', 'Blue Jeans']);
    expect(screen.getByRole('button', { name: /preview the outfit on the persona/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /view outfit \(2\)/i })).toBeInTheDocument();
  });

  it('the mini preview opens the Outfit tab too', async () => {
    const user = userEvent.setup();
    renderBuilder();
    await user.click(await screen.findByText('Linen Shirt'));

    await user.click(screen.getByRole('button', { name: /preview the outfit on the persona/i }));

    expect(screen.getByRole('tab', { name: /^Outfit/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('the Outfit tab lists the pieces as thumbnails with a way to take one off', async () => {
    const user = userEvent.setup();
    vi.spyOn(Math, 'random').mockReturnValue(0.9);
    renderBuilder();
    await screen.findByText('Linen Shirt');
    await user.click(screen.getByRole('button', { name: /create random outfit/i })); // opens the persona view

    const strip = await screen.findByLabelText('Pieces in this outfit');
    expect(within(strip).getAllByRole('img').length).toBeGreaterThan(1);

    await user.click(within(strip).getByRole('button', { name: /remove linen shirt from outfit/i }));
    expect(useOutfitDraftStore.getState().selectedItemIds).not.toContain(1);
  });

  it('the secondary actions (random, category, clear) sit at the top of the Outfit tab, not the header', async () => {
    renderBuilder();
    await screen.findByText('Linen Shirt');
    const random = screen.getByRole('button', { name: /create random outfit/i });
    expect(outfitPanel().contains(random)).toBe(true);
    expect(document.querySelector('header')!.contains(random)).toBe(false);
  });
});

describe('builder on a wide screen', () => {
  it('keeps the two panels and the header actions, with no phone tabs or dock', async () => {
    setViewport(true);
    const user = userEvent.setup();
    renderBuilder();
    await user.click(await screen.findByText('Linen Shirt'));

    const random = screen.getByRole('button', { name: /create random outfit/i });
    expect(document.querySelector('header')!.contains(random)).toBe(true);
    expect(screen.queryByLabelText('Selected pieces')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Pieces in this outfit')).not.toBeInTheDocument();
  });
});
