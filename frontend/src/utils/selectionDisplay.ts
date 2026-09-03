import { ClothingCategory } from '../types';
import type { ClothingItem } from '../types';

// Fixed display order for the "Your Selection" panel (Task 42, Phase 8.5
// Part A) - distinct from PersonaRenderer's z-index stacking order and
// Presets.ts's declaration order, which serve different purposes.
export const SELECTION_DISPLAY_ORDER: ClothingCategory[] = [
  ClothingCategory.JACKET,
  ClothingCategory.TOP,
  ClothingCategory.DRESS,
  ClothingCategory.BOTTOM,
  ClothingCategory.SHOES,
];

export interface GroupedSelection {
  category: ClothingCategory;
  items: ClothingItem[];
}

// Buckets a flat selection into SELECTION_DISPLAY_ORDER groups, in that
// order, skipping empty groups. Accessories are separated out entirely -
// callers render them in their own row (Task 43), not the main stack.
export function groupSelectedItemsForDisplay(items: ClothingItem[]): GroupedSelection[] {
  return SELECTION_DISPLAY_ORDER.reduce<GroupedSelection[]>((groups, category) => {
    const categoryItems = items.filter((item) => item.category === category);
    if (categoryItems.length > 0) {
      groups.push({ category, items: categoryItems });
    }
    return groups;
  }, []);
}

export interface PairedShoes {
  left: ClothingItem | null;
  right: ClothingItem | null;
  unpaired: ClothingItem[];
}

// Matches side === 'left'/'right' to left/right cells for the common
// one-pair case. Deliberately simple: any additional/unpaired shoe items
// (no recorded side, or more than one pair selected) fall back to
// `unpaired` in plain selection order rather than attempting full
// multi-pair matching - a known simplification, not a gap to paper over.
export function pairShoesForDisplay(shoeItems: ClothingItem[]): PairedShoes {
  let left: ClothingItem | null = null;
  let right: ClothingItem | null = null;
  const unpaired: ClothingItem[] = [];

  for (const item of shoeItems) {
    if (item.side === 'left' && !left) {
      left = item;
    } else if (item.side === 'right' && !right) {
      right = item;
    } else {
      unpaired.push(item);
    }
  }

  return { left, right, unpaired };
}
