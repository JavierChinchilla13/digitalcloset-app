import { create } from 'zustand';
import { ClothingCategory } from '../types';
import type { ClothingItem, OutfitItem, OutfitRequest } from '../types';
import { normalizeShoes } from '../utils/shoeSelection';

// Flat, item-first outfit selection (Phase 8 pivot, Task 35). Deliberately
// NOT the persona equip representation (usePersonaStore's category-bucketed
// id lists) - a flat selection is just an ordered set of item ids, and may
// legitimately include persona-ineligible items (NOT_FITTED/
// INELIGIBLE_NO_CUTOUT from Phase 7), which the persona equip flow can't
// represent at all.
interface OutfitDraftState {
  selectedItemIds: number[];
  // Task 86: a custom stacking order (item ids, bottom layer first), or null =
  // the default stacking by category. Lives in the draft only until the outfit
  // is saved / updated.
  layerOrder: number[] | null;
  toggleItem: (itemId: number) => void;
  removeItem: (itemId: number) => void;
  setDraft: (itemIds: number[], layerOrder?: number[] | null) => void;
  setLayerOrder: (layerOrder: number[] | null) => void;
  clearDraft: () => void;
}

// A custom order only ever mentions pieces that are still selected.
const prune = (layerOrder: number[] | null, selected: number[]) =>
  layerOrder ? layerOrder.filter((id) => selected.includes(id)) : null;

export const useOutfitDraftStore = create<OutfitDraftState>((set) => ({
  selectedItemIds: [],
  layerOrder: null,

  toggleItem: (itemId) => set((state) => {
    const selectedItemIds = state.selectedItemIds.includes(itemId)
      ? state.selectedItemIds.filter((id) => id !== itemId)
      : [...state.selectedItemIds, itemId];
    return { selectedItemIds, layerOrder: prune(state.layerOrder, selectedItemIds) };
  }),

  removeItem: (itemId) => set((state) => {
    const selectedItemIds = state.selectedItemIds.filter((id) => id !== itemId);
    return { selectedItemIds, layerOrder: prune(state.layerOrder, selectedItemIds) };
  }),

  setDraft: (itemIds, layerOrder = null) => set({
    selectedItemIds: itemIds,
    layerOrder: prune(layerOrder, itemIds),
  }),

  setLayerOrder: (layerOrder) => set((state) => ({ layerOrder: prune(layerOrder, state.selectedItemIds) })),

  clearDraft: () => set({ selectedItemIds: [], layerOrder: null }),
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
// Shoes without a recorded side (legacy single-image pairs) get no slot here -
// they stay valid in the flat list. The persona preview places them anyway via
// applyLegacyShoeFallback in utils/personaEligibility.ts (Task 66).
export function outfitItemsFromDraft(
  itemIds: number[],
  items: ClothingItem[],
  // Task 86: the custom stacking order, if the user set one. Each piece it
  // mentions is saved with its position in it; without one, no layerOrder is
  // sent and the outfit keeps stacking by category.
  layerOrder?: number[] | null
): OutfitRequest['items'] {
  const itemsById = new Map(items.map((item) => [item.itemId, item]));
  // Task 86: one shoe per foot, whatever the draft says (an outfit loaded from
  // before the rule may hold two for a foot) - the later one wins.
  const ids = normalizeShoes(itemIds, items);

  return ids.reduce<OutfitRequest['items']>((acc, itemId, index) => {
    const item = itemsById.get(itemId);
    if (!item) return acc;

    const slot = item.category === ClothingCategory.SHOES
      ? (item.side === 'left' ? 'leftShoe' : item.side === 'right' ? 'rightShoe' : undefined)
      : CATEGORY_TO_SLOT[item.category];

    const position = layerOrder ? layerOrder.indexOf(itemId) : -1;
    acc.push({ itemId, slot, itemOrder: index, ...(position >= 0 && { layerOrder: position }) });
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
