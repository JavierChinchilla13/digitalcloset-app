import { create } from 'zustand';
import { ClothingCategory } from '../types';
import type { ClothingItem, OutfitItem, OutfitRequest } from '../types';

// Flat, item-first outfit selection (Phase 8 pivot, Task 35). Deliberately
// NOT the persona equip representation (usePersonaStore's category-bucketed
// id lists) - a flat selection is just an ordered set of item ids, and may
// legitimately include persona-ineligible items (NOT_FITTED/
// INELIGIBLE_NO_CUTOUT from Phase 7), which the persona equip flow can't
// represent at all.
interface OutfitDraftState {
  selectedItemIds: number[];
  toggleItem: (itemId: number) => void;
  addItem: (itemId: number) => void;
  removeItem: (itemId: number) => void;
  setDraft: (itemIds: number[]) => void;
  clearDraft: () => void;
}

export const useOutfitDraftStore = create<OutfitDraftState>((set) => ({
  selectedItemIds: [],

  toggleItem: (itemId) => set((state) => ({
    selectedItemIds: state.selectedItemIds.includes(itemId)
      ? state.selectedItemIds.filter((id) => id !== itemId)
      : [...state.selectedItemIds, itemId],
  })),

  addItem: (itemId) => set((state) =>
    state.selectedItemIds.includes(itemId)
      ? state
      : { selectedItemIds: [...state.selectedItemIds, itemId] }
  ),

  removeItem: (itemId) => set((state) => ({
    selectedItemIds: state.selectedItemIds.filter((id) => id !== itemId),
  })),

  setDraft: (itemIds) => set({ selectedItemIds: itemIds }),

  clearDraft: () => set({ selectedItemIds: [] }),
}));

// --- Pure conversion between the flat draft selection and the backend's
// OutfitRequest.items[] shape. Deliberately separate from useOutfitStore's
// outfitItemsFromEquipped/equippedFromOutfitItems (Task 16) - those convert
// the persona equip representation, a fundamentally different shape from a
// flat ordered selection - rather than duplicating or modifying them. The
// persona preview path (Task 38) reuses equippedFromOutfitItems unchanged to
// project a saved outfit's items back into persona equip state.

// Mirrors useOutfitStore.ts's private CATEGORY_SLOTS mapping. Redefined
// locally rather than exported from there, to keep this task's diff isolated
// to a new file - it's shared vocabulary between the two adapters, not
// shared state.
const CATEGORY_TO_SLOT: Partial<Record<ClothingCategory, string>> = {
  [ClothingCategory.TOP]: 'top',
  [ClothingCategory.BOTTOM]: 'bottom',
  [ClothingCategory.JACKET]: 'jacket',
  [ClothingCategory.DRESS]: 'dress',
  [ClothingCategory.ACCESSORY]: 'accessory',
};

// Converts a flat draft selection into OutfitRequest.items[]. Needs the
// actual ClothingItem objects (not just ids) to derive each item's slot from
// its category, so the backend's outfit contract is populated the same way
// the persona equip path already does - letting a later persona preview
// (Task 38) bucket items correctly via the existing equippedFromOutfitItems.
// Shoes without a recorded side (legacy single-image pairs) get no slot -
// they stay valid in the flat list, they just won't appear in a persona
// preview until that's resolved (not a Task 35 concern).
export function outfitItemsFromDraft(itemIds: number[], items: ClothingItem[]): OutfitRequest['items'] {
  const itemsById = new Map(items.map((item) => [item.itemId, item]));

  return itemIds.reduce<OutfitRequest['items']>((acc, itemId, index) => {
    const item = itemsById.get(itemId);
    if (!item) return acc;

    const slot = item.category === ClothingCategory.SHOES
      ? (item.side === 'left' ? 'leftShoe' : item.side === 'right' ? 'rightShoe' : undefined)
      : CATEGORY_TO_SLOT[item.category];

    acc.push({ itemId, slot, itemOrder: index });
    return acc;
  }, []);
}

// Converts a saved outfit's items back into a flat draft selection - trivial,
// since OutfitItem already carries itemId directly; just restores the
// user's original ordering.
export function draftFromOutfitItems(items: OutfitItem[]): number[] {
  return [...items]
    .sort((a, b) => (a.itemOrder ?? 0) - (b.itemOrder ?? 0))
    .map((item) => item.itemId);
}
