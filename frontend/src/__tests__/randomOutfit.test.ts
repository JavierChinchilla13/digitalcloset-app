import { describe, expect, it } from 'vitest';
import { ClothingCategory, PersonaStatus, PersonaType, type ClothingItem } from '../types';
import { pickRandomOutfit } from '../utils/randomOutfit';

const T = { x: 0, y: 0, width: 1, height: 1, rotation: 0, scaleX: 1, scaleY: 1 };
let nextId = 1;
const make = (category: ClothingCategory, extra: Partial<ClothingItem> = {}): ClothingItem => ({
  itemId: nextId++,
  name: `${category}-${nextId}`,
  category,
  imageUrl: '/x.png',
  personaType: PersonaType.FEMALE,
  transform: T,
  ...extra,
});

// A "random" source that returns the given values in turn.
const seq = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

describe('pickRandomOutfit', () => {
  it('gives shoes, a bottom and a top, and a jacket when the dice say so', () => {
    const shoes = make(ClothingCategory.SHOES);
    const bottom = make(ClothingCategory.BOTTOM);
    const top = make(ClothingCategory.TOP);
    const jacket = make(ClothingCategory.JACKET);
    const items = [jacket, top, bottom, shoes];

    // 0 picks the first of each; the jacket roll 0.1 < 0.5 -> wears it.
    expect(pickRandomOutfit(items, PersonaType.FEMALE, seq(0)).ids).toEqual([shoes.itemId, bottom.itemId, top.itemId, jacket.itemId]);
    // The jacket roll is the 4th value: 0.9 >= 0.5 -> no jacket.
    const noJacket = pickRandomOutfit(items, PersonaType.FEMALE, seq(0, 0, 0, 0.9));
    expect(noJacket.ids).toEqual([shoes.itemId, bottom.itemId, top.itemId]);
    expect(noJacket.missing).toEqual([]);
  });

  it('is a pair of shoes: a sideless shoe alone, or a left and right with the same name', () => {
    const left = make(ClothingCategory.SHOES, { side: 'left', name: 'Runner' });
    const right = make(ClothingCategory.SHOES, { side: 'right', name: 'runner' });
    const otherLeft = make(ClothingCategory.SHOES, { side: 'left', name: 'Boot' });
    const base = [make(ClothingCategory.BOTTOM), make(ClothingCategory.TOP)];

    const pair = pickRandomOutfit([otherLeft, left, right, ...base], PersonaType.FEMALE, seq(0), 0);
    expect(pair.ids.slice(0, 2).sort()).toEqual([left.itemId, right.itemId].sort());

    const whole = make(ClothingCategory.SHOES);
    expect(pickRandomOutfit([whole, ...base], PersonaType.FEMALE, seq(0), 0).ids[0]).toBe(whole.itemId);
  });

  it('falls back to a mismatched left and right when no named pair exists', () => {
    const left = make(ClothingCategory.SHOES, { side: 'left', name: 'A' });
    const right = make(ClothingCategory.SHOES, { side: 'right', name: 'B' });
    const out = pickRandomOutfit([left, right, make(ClothingCategory.BOTTOM), make(ClothingCategory.TOP)], PersonaType.FEMALE, seq(0), 0);
    expect(out.ids).toContain(left.itemId);
    expect(out.ids).toContain(right.itemId);
    expect(out.missing).toEqual([]);
  });

  it('a lone left shoe is not a pair', () => {
    const left = make(ClothingCategory.SHOES, { side: 'left' });
    const out = pickRandomOutfit([left, make(ClothingCategory.BOTTOM), make(ClothingCategory.TOP)], PersonaType.FEMALE, seq(0), 0);
    expect(out.missing).toEqual(['shoes']);
    expect(out.ids).not.toContain(left.itemId);
  });

  it('only uses fitted, active pieces of the persona type', () => {
    const goodTop = make(ClothingCategory.TOP);
    const items = [
      make(ClothingCategory.TOP, { personaType: PersonaType.MALE }),
      make(ClothingCategory.TOP, { personaStatus: PersonaStatus.NOT_FITTED }),
      make(ClothingCategory.TOP, { active: false }),
      goodTop,
    ];
    for (const roll of [0, 0.4, 0.99]) {
      expect(pickRandomOutfit(items, PersonaType.FEMALE, seq(roll), 0).ids).toEqual([goodTop.itemId]);
    }
  });

  it('a legacy item with no status counts as fitted', () => {
    const top = make(ClothingCategory.TOP, { personaStatus: undefined });
    expect(pickRandomOutfit([top], PersonaType.FEMALE, seq(0), 0).ids).toEqual([top.itemId]);
  });

  it('lists the required categories the closet lacks, and never needs a jacket or dress', () => {
    const jacket = make(ClothingCategory.JACKET);
    const dress = make(ClothingCategory.DRESS);
    const out = pickRandomOutfit([jacket, dress], PersonaType.FEMALE, seq(0), 1);
    expect(out.missing).toEqual(['shoes', 'bottom', 'top']);
    expect(out.ids).toEqual([jacket.itemId]);
  });

  it('with several choices the roll decides, and a roll near 1 stays in range', () => {
    const tops = [make(ClothingCategory.TOP), make(ClothingCategory.TOP), make(ClothingCategory.TOP)];
    expect(pickRandomOutfit(tops, PersonaType.FEMALE, seq(0.99), 0).ids).toEqual([tops[2].itemId]);
    expect(pickRandomOutfit(tops, PersonaType.FEMALE, seq(0.4), 0).ids).toEqual([tops[1].itemId]);
  });
});
