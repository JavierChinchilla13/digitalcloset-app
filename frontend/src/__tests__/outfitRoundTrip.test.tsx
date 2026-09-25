import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';

import PersonaRenderer from '../components/PersonaRenderer';
import { useClothingStore } from '../store/useClothingStore';
import {
  equippedFromOutfitItems,
  outfitItemsFromEquipped,
  useOutfitStore,
} from '../store/useOutfitStore';
import { outfitService } from '../api/outfitService';
import { ClothingCategory, PersonaType } from '../types';
import type { Outfit, OutfitRequest, PersonaState } from '../types';
import { makeItem } from '../test/fixtures';

vi.mock('../api/outfitService', () => ({
  outfitService: {
    getOutfits: vi.fn(),
    createOutfit: vi.fn(),
    updateOutfit: vi.fn(),
    deleteOutfit: vi.fn(),
  },
}));

const service = vi.mocked(outfitService);

const SHIRT = makeItem({ itemId: 1, name: 'Shirt', category: ClothingCategory.TOP, imageUrl: 'https://img.test/shirt.png' });
const JEANS = makeItem({ itemId: 2, name: 'Jeans', category: ClothingCategory.BOTTOM, imageUrl: 'https://img.test/jeans.png' });
const SHOES = makeItem({ itemId: 3, name: 'Shoes', category: ClothingCategory.SHOES, imageUrl: 'https://img.test/shoes.png' });

// A tiny in-memory stand-in for the backend: it assigns ids on create and
// serves back exactly what was stored, like the real controller does. Keeping
// it stateful is what makes "create -> reload -> read" a real round trip.
function installFakeBackend() {
  let nextId = 100;
  let stored: Outfit[] = [];

  service.getOutfits.mockImplementation(async () => structuredClone(stored));
  service.createOutfit.mockImplementation(async (data: OutfitRequest) => {
    const outfit: Outfit = {
      outfitId: nextId++,
      name: data.name,
      description: data.description,
      avatarType: data.avatarType,
      createdAt: '2026-09-24T00:00:00',
      items: data.items.map((item, i) => ({ outfitItemId: nextId * 10 + i, ...item })),
    };
    stored.push(outfit);
    return structuredClone(outfit);
  });
  service.updateOutfit.mockImplementation(async (id: number, data: OutfitRequest) => {
    const existing = stored.find((o) => o.outfitId === id)!;
    Object.assign(existing, {
      name: data.name,
      description: data.description,
      avatarType: data.avatarType,
      items: data.items.map((item, i) => ({ outfitItemId: id * 10 + i, ...item })),
    });
    return structuredClone(existing);
  });
  service.deleteOutfit.mockImplementation(async (id: number) => {
    stored = stored.filter((o) => o.outfitId !== id);
  });
}

// Blueprint Phase 5, area 6 ("Outfit Round Trip"): Create -> Backend -> Reload -> Backend -> Render.
describe('outfit round trip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installFakeBackend();
    useOutfitStore.setState({ outfits: [], isLoading: false, error: null });
    useClothingStore.setState({ items: [SHIRT, JEANS, SHOES] });
  });

  it('equip state -> request items -> back to equip state is lossless', () => {
    const equipped = {
      topIds: [1],
      bottomIds: [2],
      leftShoeId: 3,
      rightShoeId: 3,
      accessoryIds: [],
      jacketIds: [],
      dressIds: [],
    };

    const items = outfitItemsFromEquipped(equipped);
    const asStored = items.map((item, i) => ({ outfitItemId: i, ...item }));

    expect(equippedFromOutfitItems(asStored)).toEqual(equipped);
  });

  it('a saved outfit survives a reload and renders on the persona', async () => {
    const equipped = {
      topIds: [1],
      bottomIds: [2],
      leftShoeId: 3,
      rightShoeId: 3,
      accessoryIds: [],
      jacketIds: [],
      dressIds: [],
    };

    // Create through the store, as the builder's Save button does.
    const saved = await useOutfitStore.getState().saveOutfit({
      name: 'Weekend',
      avatarType: PersonaType.FEMALE,
      items: outfitItemsFromEquipped(equipped),
    });
    expect(saved.outfitId).toBe(100);

    // "Reload": the client loses all in-memory state and re-reads the backend.
    useOutfitStore.setState({ outfits: [] });
    await useOutfitStore.getState().fetchOutfits();

    const reloaded = useOutfitStore.getState().outfits;
    expect(reloaded).toHaveLength(1);
    expect(reloaded[0].name).toBe('Weekend');

    // Render: rebuild the persona from what the backend returned.
    const persona: PersonaState = { type: PersonaType.FEMALE, ...equippedFromOutfitItems(reloaded[0].items) };
    const { container } = render(<PersonaRenderer persona={persona} />);

    await waitFor(() => {
      const srcs = Array.from(container.querySelectorAll('img')).map((img) => img.getAttribute('src'));
      expect(srcs).toEqual(expect.arrayContaining([SHIRT.imageUrl, JEANS.imageUrl, SHOES.imageUrl]));
    });
  });

  it('editing replaces the outfit and the change is what a reload returns', async () => {
    const { outfitId } = await useOutfitStore.getState().saveOutfit({
      name: 'Weekend',
      avatarType: PersonaType.FEMALE,
      items: [{ itemId: 1, slot: 'top', itemOrder: 0 }],
    });

    await useOutfitStore.getState().updateOutfit(outfitId, {
      name: 'Weekend v2',
      avatarType: PersonaType.FEMALE,
      items: [{ itemId: 2, slot: 'bottom', itemOrder: 0 }],
    });
    useOutfitStore.setState({ outfits: [] });
    await useOutfitStore.getState().fetchOutfits();

    const [outfit] = useOutfitStore.getState().outfits;
    expect(outfit.name).toBe('Weekend v2');
    expect(outfit.items.map((i) => i.itemId)).toEqual([2]);
  });

  it('duplicate creates a separate "(Copy)" outfit with the same items', async () => {
    const original = await useOutfitStore.getState().saveOutfit({
      name: 'Weekend',
      avatarType: PersonaType.FEMALE,
      items: [
        { itemId: 1, slot: 'top', itemOrder: 0 },
        { itemId: 2, slot: 'bottom', itemOrder: 1 },
      ],
    });

    await useOutfitStore.getState().duplicateOutfit(original);

    const outfits = useOutfitStore.getState().outfits;
    expect(outfits.map((o) => o.name)).toEqual(['Weekend', 'Weekend (Copy)']);
    expect(outfits[1].outfitId).not.toBe(outfits[0].outfitId);
    expect(outfits[1].items.map((i) => i.itemId)).toEqual([1, 2]);
  });

  it('removing an outfit removes it for good, including after a reload', async () => {
    const { outfitId } = await useOutfitStore.getState().saveOutfit({
      name: 'Weekend',
      avatarType: PersonaType.FEMALE,
      items: [{ itemId: 1, slot: 'top', itemOrder: 0 }],
    });

    await useOutfitStore.getState().removeOutfit(outfitId);
    expect(useOutfitStore.getState().outfits).toHaveLength(0);
    await useOutfitStore.getState().fetchOutfits();

    expect(useOutfitStore.getState().outfits).toHaveLength(0);
  });
});
