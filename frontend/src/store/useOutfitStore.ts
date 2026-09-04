import { create } from 'zustand';
import type { Outfit, OutfitItem, OutfitRequest } from '../types';
import { outfitService } from '../api/outfitService';

interface OutfitState {
  outfits: Outfit[];
  isLoading: boolean;
  error: string | null;
  fetchOutfits: () => Promise<void>;
  saveOutfit: (data: OutfitRequest) => Promise<Outfit>;
  updateOutfit: (outfitId: number, data: OutfitRequest) => Promise<void>;
  removeOutfit: (outfitId: number) => Promise<void>;
  duplicateOutfit: (outfit: Outfit) => Promise<void>;
}

export const useOutfitStore = create<OutfitState>((set) => ({
  outfits: [],
  isLoading: false,
  error: null,

  fetchOutfits: async () => {
    set({ isLoading: true, error: null });
    try {
      const outfits = await outfitService.getOutfits();
      set({ outfits, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  saveOutfit: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const newOutfit = await outfitService.createOutfit(data);
      set((state) => ({ outfits: [...state.outfits, newOutfit], isLoading: false }));
      return newOutfit;
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      throw err;
    }
  },

  updateOutfit: async (outfitId, data) => {
    set({ isLoading: true, error: null });
    try {
      const updated = await outfitService.updateOutfit(outfitId, data);
      set((state) => ({
        outfits: state.outfits.map((o) => (o.outfitId === outfitId ? updated : o)),
        isLoading: false,
      }));
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  removeOutfit: async (outfitId) => {
    set({ isLoading: true, error: null });
    try {
      await outfitService.deleteOutfit(outfitId);
      set((state) => ({
        outfits: state.outfits.filter((o) => o.outfitId !== outfitId),
        isLoading: false,
      }));
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  // Duplicates by re-submitting the same items as a new outfit - the backend
  // assigns a fresh outfitId, there's no dedicated "duplicate" endpoint.
  duplicateOutfit: async (outfit) => {
    set({ isLoading: true, error: null });
    try {
      const newOutfit = await outfitService.createOutfit({
        name: `${outfit.name} (Copy)`,
        description: outfit.description,
        avatarType: outfit.avatarType,
        items: outfit.items.map(({ itemId, slot, itemOrder }) => ({ itemId, slot, itemOrder })),
      });
      set((state) => ({ outfits: [...state.outfits, newOutfit], isLoading: false }));
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },
}));

// --- Conversion between the persona/local equip representation and the
// backend's flat OutfitRequest items[] shape (Task 16). Kept as small pure
// functions, not new state - both directions are deterministic and lossless
// for what the app actually uses (equip state, not visual placement, which
// lives on ClothingItem.transform and is untouched by any of this).

export interface EquippedItemIds {
  topIds: number[];
  bottomIds: number[];
  leftShoeId: number | null;
  rightShoeId: number | null;
  accessoryIds: number[];
  jacketIds: number[];
  dressIds: number[];
}

const CATEGORY_SLOTS: { key: keyof EquippedItemIds; slot: string }[] = [
  { key: 'topIds', slot: 'top' },
  { key: 'bottomIds', slot: 'bottom' },
  { key: 'jacketIds', slot: 'jacket' },
  { key: 'dressIds', slot: 'dress' },
  { key: 'accessoryIds', slot: 'accessory' },
];

export function outfitItemsFromEquipped(equipped: EquippedItemIds): OutfitRequest['items'] {
  const items: OutfitRequest['items'] = [];
  let order = 0;

  CATEGORY_SLOTS.forEach(({ key, slot }) => {
    (equipped[key] as number[]).forEach((itemId) => {
      items.push({ itemId, slot, itemOrder: order++ });
    });
  });

  if (equipped.leftShoeId != null) {
    items.push({ itemId: equipped.leftShoeId, slot: 'leftShoe', itemOrder: order++ });
  }
  if (equipped.rightShoeId != null) {
    items.push({ itemId: equipped.rightShoeId, slot: 'rightShoe', itemOrder: order++ });
  }

  return items;
}

export function equippedFromOutfitItems(items: OutfitItem[]): EquippedItemIds {
  const result: EquippedItemIds = {
    topIds: [],
    bottomIds: [],
    leftShoeId: null,
    rightShoeId: null,
    accessoryIds: [],
    jacketIds: [],
    dressIds: [],
  };

  const sorted = [...items].sort((a, b) => (a.itemOrder ?? 0) - (b.itemOrder ?? 0));

  sorted.forEach((item) => {
    switch (item.slot) {
      case 'top': result.topIds.push(item.itemId); break;
      case 'bottom': result.bottomIds.push(item.itemId); break;
      case 'jacket': result.jacketIds.push(item.itemId); break;
      case 'dress': result.dressIds.push(item.itemId); break;
      case 'accessory': result.accessoryIds.push(item.itemId); break;
      case 'leftShoe': result.leftShoeId = item.itemId; break;
      case 'rightShoe': result.rightShoeId = item.itemId; break;
    }
  });

  return result;
}
