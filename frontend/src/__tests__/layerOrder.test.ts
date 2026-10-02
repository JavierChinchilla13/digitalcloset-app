import { describe, expect, it } from 'vitest';
import { ClothingCategory as C } from '../types';
import type { OutfitItem } from '../types';
import { defaultStack, layerOrderFromOutfitItems, moveInStack, moveToIndex, resolveStack } from '../utils/layerOrder';
import { makeItem } from '../test/fixtures';

// Task 86: the order pieces are stacked on the persona. Default = by category
// (pants at the bottom ... accessories on top); a custom order is a list of
// item ids from the bottom layer up.
const pants = makeItem({ itemId: 1, name: 'Pants', category: C.BOTTOM });
const shoes = makeItem({ itemId: 2, name: 'Shoes', category: C.SHOES });
const tee = makeItem({ itemId: 3, name: 'Tee', category: C.TOP });
const jacket = makeItem({ itemId: 4, name: 'Jacket', category: C.JACKET });
const watch = makeItem({ itemId: 5, name: 'Watch', category: C.ACCESSORY });
const items = [pants, shoes, tee, jacket, watch];

describe('defaultStack', () => {
  it('orders by category regardless of selection order', () => {
    expect(defaultStack([4, 3, 1, 5, 2], items)).toEqual([1, 2, 3, 4, 5]);
  });

  it('keeps selection order within a category and drops unknown ids', () => {
    const tee2 = makeItem({ itemId: 6, category: C.TOP });
    expect(defaultStack([6, 3, 99], [...items, tee2])).toEqual([6, 3]);
  });
});

describe('resolveStack', () => {
  it('is the default stack with no custom order', () => {
    expect(resolveStack([3, 1], items, null)).toEqual([1, 3]);
    expect(resolveStack([3, 1], items, [])).toEqual([1, 3]);
  });

  it('uses the custom order: pants over the shirt', () => {
    expect(resolveStack([1, 3], items, [3, 1])).toEqual([3, 1]);
  });

  it('ignores pieces in the order that are no longer selected', () => {
    expect(resolveStack([1, 3], items, [3, 99, 4, 1])).toEqual([3, 1]);
  });

  it('slots a piece added later where its category would put it', () => {
    // Custom: pants over tee. A jacket is added afterwards: it goes on top.
    expect(resolveStack([1, 3, 4], items, [3, 1])).toEqual([3, 1, 4]);
    // Shoes added: they go under the first piece that ranks higher (the tee).
    expect(resolveStack([1, 2, 3], items, [3, 1])).toEqual([2, 3, 1]);
  });

  it('shows each piece once', () => {
    expect(resolveStack([1, 3], items, [3, 3, 1])).toEqual([3, 1]);
  });
});

describe('moveInStack', () => {
  const stack = [1, 3, 4];

  it('moves a piece one step toward the front', () => {
    expect(moveInStack(stack, 3, 'up')).toEqual([1, 4, 3]);
  });

  it('moves a piece one step toward the back', () => {
    expect(moveInStack(stack, 3, 'down')).toEqual([3, 1, 4]);
  });

  it('a piece already at that end stays put, and unknown ids change nothing', () => {
    expect(moveInStack(stack, 4, 'up')).toEqual(stack);
    expect(moveInStack(stack, 1, 'down')).toEqual(stack);
    expect(moveInStack(stack, 99, 'up')).toEqual(stack);
  });

  it('does not change the list it was given', () => {
    moveInStack(stack, 3, 'up');
    expect(stack).toEqual([1, 3, 4]);
  });
});

describe('moveToIndex (drag and drop)', () => {
  const stack = [1, 2, 3, 4];

  it('puts the piece in the dropped place, shifting the others', () => {
    expect(moveToIndex(stack, 4, 0)).toEqual([4, 1, 2, 3]); // to the very back
    expect(moveToIndex(stack, 1, 3)).toEqual([2, 3, 4, 1]); // to the very front
    expect(moveToIndex(stack, 2, 2)).toEqual([1, 3, 2, 4]);
  });

  it('dropping where it already is, or on an unknown piece, changes nothing', () => {
    expect(moveToIndex(stack, 2, 1)).toBe(stack);
    expect(moveToIndex(stack, 99, 0)).toBe(stack);
  });

  it('clamps an out-of-range drop to the ends', () => {
    expect(moveToIndex(stack, 2, 99)).toEqual([1, 3, 4, 2]);
    expect(moveToIndex(stack, 3, -5)).toEqual([3, 1, 2, 4]);
  });
});

describe('layerOrderFromOutfitItems', () => {
  const oi = (itemId: number, layerOrder?: number | null): OutfitItem => ({ outfitItemId: itemId, itemId, layerOrder });

  it('lists the items with a saved layer order, bottom first', () => {
    expect(layerOrderFromOutfitItems([oi(1, 1), oi(2, 0), oi(3, 2)])).toEqual([2, 1, 3]);
  });

  it('is null for an outfit saved without one (the default stacking)', () => {
    expect(layerOrderFromOutfitItems([oi(1), oi(2, null)])).toBeNull();
  });
});
