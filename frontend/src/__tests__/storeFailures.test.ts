import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useClothingStore } from '../store/useClothingStore';
import { useOutfitStore } from '../store/useOutfitStore';
import { useCollectionStore } from '../store/useCollectionStore';
import { clothingService } from '../api/clothingService';
import { outfitService } from '../api/outfitService';
import { collectionService } from '../api/collectionService';
import { PersonaType } from '../types';
import type { Collection, Outfit } from '../types';
import { makeItem } from '../test/fixtures';

vi.mock('../api/clothingService', () => ({
  clothingService: {
    getClothingItems: vi.fn(),
    createClothingItem: vi.fn(),
    updateClothingItem: vi.fn(),
    deleteClothingItem: vi.fn(),
  },
}));
vi.mock('../api/outfitService', () => ({
  outfitService: { getOutfits: vi.fn(), createOutfit: vi.fn(), updateOutfit: vi.fn(), deleteOutfit: vi.fn() },
}));
vi.mock('../api/collectionService', () => ({
  collectionService: {
    getCollections: vi.fn(),
    renameCollection: vi.fn(),
    deleteCollection: vi.fn(),
    removeItemFromCollection: vi.fn(),
    removeOutfitFromCollection: vi.fn(),
  },
}));

const clothing = vi.mocked(clothingService);
const outfits = vi.mocked(outfitService);
const collections = vi.mocked(collectionService);

const boom = () => new Error('network down');

// Task 22's rule, locked in: a failing mutation must REJECT (so callers can
// tell the user and keep their draft) and must leave the data untouched; a
// failing fetch must not throw but must record the error (so pages can show
// a retry state instead of an empty account).
describe('clothing store failures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useClothingStore.setState({ items: [makeItem({ itemId: 1 }), makeItem({ itemId: 2 })], error: null, isLoading: false });
  });

  it('fetchItems swallows the failure, records it, and keeps existing items', async () => {
    clothing.getClothingItems.mockRejectedValue(boom());

    await expect(useClothingStore.getState().fetchItems()).resolves.toBeUndefined();

    const state = useClothingStore.getState();
    expect(state.error).toBe('network down');
    expect(state.isLoading).toBe(false);
    expect(state.items).toHaveLength(2);
  });

  it('fetchItems success clears a previous error', async () => {
    useClothingStore.setState({ error: 'old' });
    clothing.getClothingItems.mockResolvedValue([makeItem({ itemId: 9 })]);

    await useClothingStore.getState().fetchItems();

    expect(useClothingStore.getState().error).toBeNull();
    expect(useClothingStore.getState().items.map((i) => i.itemId)).toEqual([9]);
  });

  it('addItem rejects on failure and adds nothing', async () => {
    clothing.createClothingItem.mockRejectedValue(boom());

    await expect(useClothingStore.getState().addItem(makeItem() as never)).rejects.toThrow('network down');

    expect(useClothingStore.getState().items).toHaveLength(2);
  });

  it('updateItem rejects on failure and leaves the item as it was', async () => {
    clothing.updateClothingItem.mockRejectedValue(boom());

    await expect(useClothingStore.getState().updateItem(1, { name: 'Renamed' })).rejects.toThrow('network down');

    expect(useClothingStore.getState().items.find((i) => i.itemId === 1)?.name).toBe('White Shirt');
  });

  it('removeItem rejects on failure and keeps the item', async () => {
    clothing.deleteClothingItem.mockRejectedValue(boom());

    await expect(useClothingStore.getState().removeItem(1)).rejects.toThrow('network down');

    expect(useClothingStore.getState().items.map((i) => i.itemId)).toEqual([1, 2]);
  });

  it('removeItem success drops exactly that item', async () => {
    clothing.deleteClothingItem.mockResolvedValue(undefined);

    await useClothingStore.getState().removeItem(1);

    expect(useClothingStore.getState().items.map((i) => i.itemId)).toEqual([2]);
  });
});

describe('outfit store failures', () => {
  const outfit: Outfit = {
    outfitId: 10,
    name: 'Look',
    avatarType: PersonaType.FEMALE,
    createdAt: '2026-09-24T00:00:00',
    items: [{ outfitItemId: 1, itemId: 1, slot: 'top', itemOrder: 0 }],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useOutfitStore.setState({ outfits: [outfit], error: null, isLoading: false });
  });

  it('fetchOutfits swallows the failure and records it', async () => {
    outfits.getOutfits.mockRejectedValue(boom());

    await expect(useOutfitStore.getState().fetchOutfits()).resolves.toBeUndefined();

    expect(useOutfitStore.getState().error).toBe('network down');
  });

  it('saveOutfit rejects on failure', async () => {
    outfits.createOutfit.mockRejectedValue(boom());

    await expect(
      useOutfitStore.getState().saveOutfit({ name: 'x', avatarType: PersonaType.FEMALE, items: [] })
    ).rejects.toThrow('network down');
    expect(useOutfitStore.getState().outfits).toHaveLength(1);
  });

  it('updateOutfit rejects on failure and keeps the old outfit', async () => {
    outfits.updateOutfit.mockRejectedValue(boom());

    await expect(
      useOutfitStore.getState().updateOutfit(10, { name: 'New', avatarType: PersonaType.FEMALE, items: [] })
    ).rejects.toThrow('network down');
    expect(useOutfitStore.getState().outfits[0].name).toBe('Look');
  });

  it('removeOutfit rejects on failure and keeps the outfit', async () => {
    outfits.deleteOutfit.mockRejectedValue(boom());

    await expect(useOutfitStore.getState().removeOutfit(10)).rejects.toThrow('network down');
    expect(useOutfitStore.getState().outfits).toHaveLength(1);
  });

  it('duplicateOutfit rejects on failure and adds no copy', async () => {
    outfits.createOutfit.mockRejectedValue(boom());

    await expect(useOutfitStore.getState().duplicateOutfit(outfit)).rejects.toThrow('network down');
    expect(useOutfitStore.getState().outfits).toHaveLength(1);
  });
});

describe('collection store failures', () => {
  const collection: Collection = {
    collectionId: 5,
    name: 'Summer',
    createdAt: '2026-09-24T00:00:00',
    items: [],
    outfits: [],
  } as Collection;

  beforeEach(() => {
    vi.clearAllMocks();
    useCollectionStore.setState({ collections: [collection], error: null, isLoading: false });
  });

  it('fetchCollections swallows the failure and records it', async () => {
    collections.getCollections.mockRejectedValue(boom());

    await expect(useCollectionStore.getState().fetchCollections()).resolves.toBeUndefined();

    expect(useCollectionStore.getState().error).toBe('network down');
  });

  it('renameCollection rejects on failure and keeps the old name', async () => {
    collections.renameCollection.mockRejectedValue(boom());

    await expect(useCollectionStore.getState().renameCollection(5, 'Winter')).rejects.toThrow('network down');
    expect(useCollectionStore.getState().collections[0].name).toBe('Summer');
  });

  it('deleteCollection rejects on failure and keeps the collection', async () => {
    collections.deleteCollection.mockRejectedValue(boom());

    await expect(useCollectionStore.getState().deleteCollection(5)).rejects.toThrow('network down');
    expect(useCollectionStore.getState().collections).toHaveLength(1);
  });
});
