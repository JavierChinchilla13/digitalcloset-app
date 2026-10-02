import { ClothingCategory, type ClothingItem } from '../types';

// One shoe per foot (Task 86). A shoe saved as a pair carries a side (left /
// right); an older shoe with no side is one picture of both - a pair - so it
// takes both feet. Choosing a shoe for a foot that already has one swaps it
// (the caller tells the user), instead of quietly stacking two on one foot.

type Foot = 'left' | 'right';

export function shoeFeet(item: Pick<ClothingItem, 'side'>): Foot[] {
  if (item.side === 'left') return ['left'];
  if (item.side === 'right') return ['right'];
  return ['left', 'right'];
}

const isShoe = (item: ClothingItem | undefined): item is ClothingItem =>
  !!item && item.category === ClothingCategory.SHOES;

// Adds `incomingId` to the selection. For a shoe, every selected shoe that
// shares a foot with it is dropped first and returned as `replaced`.
export function addWithShoeRule(
  selectedIds: number[],
  items: ClothingItem[],
  incomingId: number
): { ids: number[]; replaced: ClothingItem[] } {
  if (selectedIds.includes(incomingId)) return { ids: selectedIds, replaced: [] };

  const byId = new Map(items.map((item) => [item.itemId, item]));
  const incoming = byId.get(incomingId);
  if (!isShoe(incoming)) return { ids: [...selectedIds, incomingId], replaced: [] };

  const feet = new Set(shoeFeet(incoming));
  const replaced: ClothingItem[] = [];
  const kept = selectedIds.filter((id) => {
    const other = byId.get(id);
    if (!isShoe(other)) return true;
    if (!shoeFeet(other).some((foot) => feet.has(foot))) return true;
    replaced.push(other);
    return false;
  });
  return { ids: [...kept, incomingId], replaced };
}

// Click on a card: deselects it if selected, otherwise adds it under the shoe rule.
export function toggleWithShoeRule(
  selectedIds: number[],
  items: ClothingItem[],
  itemId: number
): { ids: number[]; replaced: ClothingItem[] } {
  if (selectedIds.includes(itemId)) {
    return { ids: selectedIds.filter((id) => id !== itemId), replaced: [] };
  }
  return addWithShoeRule(selectedIds, items, itemId);
}

// Cleans a selection that may already break the rule (an outfit saved before
// the rule existed): items are re-added in order, so the LATER shoe for a foot
// wins. Ids that aren't in `items` (not loaded yet) are kept as they are.
export function normalizeShoes(selectedIds: number[], items: ClothingItem[]): number[] {
  let ids: number[] = [];
  for (const id of selectedIds) ids = addWithShoeRule(ids, items, id).ids;
  return ids;
}
