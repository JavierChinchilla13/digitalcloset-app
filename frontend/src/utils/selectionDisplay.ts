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

// Task 75 follow-up (Phase 9.7): the Outfit Showcase's default (non-persona)
// display of the active outfit - stacked category rows, one representative
// image per row plus a "+N" badge for anything beyond it, rather than the
// full multi-item grid groupSelectedItemsForDisplay above builds for the
// Attire builder's selection panel. Distinct rules from that function:
// a Dress REPLACES the Jacket/Top rows entirely (not shown alongside them),
// and Accessories never get a row/image at all - just a trailing count,
// handled by the caller since there's no image to show.
export interface ShowcaseRow {
  category: ClothingCategory;
  // The image(s) actually shown for this row. Normally one; SHOES shows up
  // to two (left+right), since hiding one foot behind a "+1" badge would
  // misrepresent an ordinary pair as having an extra item.
  displayItems: ClothingItem[];
  // Items in this category beyond what's pictured in displayItems.
  extraCount: number;
}

export function buildShowcaseRows(items: ClothingItem[]): ShowcaseRow[] {
  const rows: ShowcaseRow[] = [];
  const byCategory = (cat: ClothingCategory) => items.filter((item) => item.category === cat);

  const dressItems = byCategory(ClothingCategory.DRESS);
  if (dressItems.length > 0) {
    rows.push({ category: ClothingCategory.DRESS, displayItems: [dressItems[0]], extraCount: dressItems.length - 1 });
  } else {
    const jacketItems = byCategory(ClothingCategory.JACKET);
    if (jacketItems.length > 0) {
      rows.push({ category: ClothingCategory.JACKET, displayItems: [jacketItems[0]], extraCount: jacketItems.length - 1 });
    }
    const topItems = byCategory(ClothingCategory.TOP);
    if (topItems.length > 0) {
      rows.push({ category: ClothingCategory.TOP, displayItems: [topItems[0]], extraCount: topItems.length - 1 });
    }
  }

  const bottomItems = byCategory(ClothingCategory.BOTTOM);
  if (bottomItems.length > 0) {
    rows.push({ category: ClothingCategory.BOTTOM, displayItems: [bottomItems[0]], extraCount: bottomItems.length - 1 });
  }

  const shoeItems = byCategory(ClothingCategory.SHOES);
  if (shoeItems.length > 0) {
    const { left, right } = pairShoesForDisplay(shoeItems);
    const displayItems = [left, right].filter((item): item is ClothingItem => !!item);
    // Nothing recorded a side at all (legacy single-image pair) - fall
    // back to showing just the one image, same as PersonaRenderer's own
    // legacy-pair handling does for this case.
    if (displayItems.length === 0) displayItems.push(shoeItems[0]);
    rows.push({ category: ClothingCategory.SHOES, displayItems, extraCount: shoeItems.length - displayItems.length });
  }

  return rows;
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
