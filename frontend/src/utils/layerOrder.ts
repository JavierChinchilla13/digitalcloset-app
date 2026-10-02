import { ClothingCategory, type ClothingItem, type OutfitItem } from '../types';

// The order pieces are stacked on the persona (Task 86). By default it follows
// the category (pants at the bottom, jackets near the top); a user can put any
// piece above or below another, and that custom order is remembered as a list
// of item ids from the bottom layer up.

// The default stacking, bottom to top. (PersonaRenderer's own z-ranges.)
export const CATEGORY_RANK: Record<ClothingCategory, number> = {
  [ClothingCategory.BOTTOM]: 100,
  [ClothingCategory.SHOES]: 200,
  [ClothingCategory.DRESS]: 250,
  [ClothingCategory.TOP]: 300,
  [ClothingCategory.JACKET]: 400,
  [ClothingCategory.ACCESSORY]: 500,
};

// `ids` in the default stacking order (selection order breaks ties). Ids that
// aren't in `items` are dropped - they can't be drawn.
export function defaultStack(ids: number[], items: ClothingItem[]): number[] {
  const byId = new Map(items.map((item) => [item.itemId, item]));
  return ids
    .map((id, index) => ({ id, index, item: byId.get(id) }))
    .filter((entry): entry is { id: number; index: number; item: ClothingItem } => !!entry.item)
    .sort((a, b) => CATEGORY_RANK[a.item.category] - CATEGORY_RANK[b.item.category] || a.index - b.index)
    .map((entry) => entry.id);
}

// The stack to draw: the custom `layerOrder` where there is one, with any piece
// it doesn't mention (added after the order was set) slotted in where the
// default stacking would put it - just under the first piece whose category
// ranks higher. Pieces in `layerOrder` that are no longer selected are ignored.
export function resolveStack(
  ids: number[],
  items: ClothingItem[],
  layerOrder: number[] | null | undefined
): number[] {
  const base = defaultStack(ids, items);
  if (!layerOrder || layerOrder.length === 0) return base;

  const byId = new Map(items.map((item) => [item.itemId, item]));
  const present = new Set(base);
  const stack = layerOrder.filter((id, i) => present.has(id) && layerOrder.indexOf(id) === i);
  const rank = (id: number) => CATEGORY_RANK[byId.get(id)!.category];

  for (const id of base) {
    if (stack.includes(id)) continue;
    const at = stack.findIndex((other) => rank(other) > rank(id));
    stack.splice(at < 0 ? stack.length : at, 0, id);
  }
  return stack;
}

// Moves `id` one step toward the top ('up', in front of more pieces) or the
// bottom ('down'). A piece already at that end stays put.
export function moveInStack(stack: number[], id: number, direction: 'up' | 'down'): number[] {
  const from = stack.indexOf(id);
  if (from < 0) return stack;
  const to = direction === 'up' ? from + 1 : from - 1;
  if (to < 0 || to >= stack.length) return stack;
  const next = [...stack];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

// Drag and drop: takes `id` out of the stack and puts it at `toIndex` of the
// result (0 = back-most), so dropping on a row gives the piece that row's place.
export function moveToIndex(stack: number[], id: number, toIndex: number): number[] {
  const from = stack.indexOf(id);
  if (from < 0) return stack;
  const clamped = Math.max(0, Math.min(stack.length - 1, toIndex));
  if (clamped === from) return stack;
  const next = stack.filter((other) => other !== id);
  next.splice(clamped, 0, id);
  return next;
}

// A saved outfit's custom order (item ids, bottom first), or null when it has
// none - i.e. it was saved before layer order existed, or never customised.
export function layerOrderFromOutfitItems(items: OutfitItem[]): number[] | null {
  const ordered = items
    .filter((item) => item.layerOrder != null)
    .sort((a, b) => (a.layerOrder as number) - (b.layerOrder as number));
  return ordered.length ? ordered.map((item) => item.itemId) : null;
}
