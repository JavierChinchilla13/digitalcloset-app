import { describe, expect, it } from 'vitest';
import { ClothingCategory } from '../types';
import { addWithShoeRule, normalizeShoes, shoeFeet, toggleWithShoeRule } from '../utils/shoeSelection';
import { makeItem } from '../test/fixtures';

// Task 86: one shoe per foot. A shoe with a side takes that foot; a shoe with
// no side is one picture of the pair and takes both. Picking a shoe for a foot
// that already has one swaps it.
const shoe = (itemId: number, name: string, side?: 'left' | 'right') =>
  makeItem({ itemId, name, category: ClothingCategory.SHOES, side });
const tee = makeItem({ itemId: 1, name: 'Tee', category: ClothingCategory.TOP });
const leftA = shoe(10, 'Runner', 'left');
const rightA = shoe(11, 'Runner', 'right');
const leftB = shoe(12, 'Boot', 'left');
const rightB = shoe(13, 'Boot', 'right');
const pairC = shoe(14, 'Sneaker'); // no side: both feet
const pairD = shoe(15, 'Loafer'); // no side: both feet
const items = [tee, leftA, rightA, leftB, rightB, pairC, pairD];

describe('shoeFeet', () => {
  it('a sided shoe takes its foot, an unsided one both', () => {
    expect(shoeFeet(leftA)).toEqual(['left']);
    expect(shoeFeet(rightA)).toEqual(['right']);
    expect(shoeFeet(pairC)).toEqual(['left', 'right']);
  });
});

describe('addWithShoeRule', () => {
  it('a left and a right shoe go together (a mismatched pair is allowed)', () => {
    const first = addWithShoeRule([], items, 10);
    const both = addWithShoeRule(first.ids, items, 13);
    expect(both.ids).toEqual([10, 13]);
    expect(both.replaced).toEqual([]);
  });

  it('a second left shoe swaps the first one and reports it', () => {
    const { ids, replaced } = addWithShoeRule([10, 11], items, 12);
    expect(ids).toEqual([11, 12]); // right stays, left is now the boot
    expect(replaced.map((r) => r.itemId)).toEqual([10]);
  });

  it('a shoe with no side replaces every shoe it overlaps (both feet)', () => {
    const { ids, replaced } = addWithShoeRule([1, 10, 11], items, 14);
    expect(ids).toEqual([1, 14]);
    expect(replaced.map((r) => r.itemId).sort()).toEqual([10, 11]);
  });

  it('a sided shoe replaces a pair that covers its foot', () => {
    const { ids, replaced } = addWithShoeRule([14], items, 12);
    expect(ids).toEqual([12]); // the pair is gone entirely; the right foot is now empty
    expect(replaced.map((r) => r.itemId)).toEqual([14]);
  });

  it('two unsided shoes cannot be selected together', () => {
    expect(addWithShoeRule([14], items, 15).ids).toEqual([15]);
  });

  it('non-shoes are just added, and nothing is replaced', () => {
    const { ids, replaced } = addWithShoeRule([10], items, 1);
    expect(ids).toEqual([10, 1]);
    expect(replaced).toEqual([]);
  });

  it('adding what is already selected changes nothing', () => {
    expect(addWithShoeRule([10], items, 10).ids).toEqual([10]);
  });
});

describe('toggleWithShoeRule', () => {
  it('clicking a selected piece removes it', () => {
    expect(toggleWithShoeRule([1, 10], items, 10).ids).toEqual([1]);
  });

  it('clicking an unselected shoe for an occupied foot swaps', () => {
    const { ids, replaced } = toggleWithShoeRule([10], items, 12);
    expect(ids).toEqual([12]);
    expect(replaced[0].name).toBe('Runner');
  });
});

describe('normalizeShoes', () => {
  it('keeps the LATER shoe for a foot in an outfit that already breaks the rule', () => {
    expect(normalizeShoes([10, 11, 12], items)).toEqual([11, 12]);
  });

  it('leaves a valid selection (and unknown ids) alone', () => {
    expect(normalizeShoes([1, 10, 13, 999], items)).toEqual([1, 10, 13, 999]);
  });
});
