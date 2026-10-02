import { ClothingCategory, type ClothingItem, type PersonaType } from '../types';
import { isFittedStatus } from './personaEligibility';
import { normalizeShoes } from './shoeSelection';

// "Create random outfit" (Task 87): picks a wearable outfit from the closet - a
// pair of shoes, a bottom and a shirt, plus a jacket some of the time.

export interface RandomOutfit {
  // Item ids in the order they are added: shoes, bottom, top, jacket.
  ids: number[];
  // Required pieces the closet has no eligible item for ('shoes' | 'bottom' | 'top').
  missing: Array<'shoes' | 'bottom' | 'top'>;
}

const pick = <T,>(options: T[], random: () => number): T | undefined =>
  options.length > 0 ? options[Math.min(options.length - 1, Math.floor(random() * options.length))] : undefined;

const sameName = (a: ClothingItem, b: ClothingItem) => a.name.trim().toLowerCase() === b.name.trim().toLowerCase();

// Every way to put shoes on both feet: a sideless shoe is a pair by itself, and a
// left + right with the same name are a pair (as the builder grid shows them).
// Only when the closet has no such pair do mismatched left + right shoes count.
function shoeSets(shoes: ClothingItem[]): number[][] {
  const lefts = shoes.filter((shoe) => shoe.side === 'left');
  const rights = shoes.filter((shoe) => shoe.side === 'right');
  const whole = shoes.filter((shoe) => shoe.side !== 'left' && shoe.side !== 'right').map((shoe) => [shoe.itemId]);

  const matched = lefts.flatMap((left) =>
    rights.filter((right) => sameName(left, right)).map((right) => [left.itemId, right.itemId])
  );
  const sets = [...whole, ...matched];
  if (sets.length > 0) return sets;

  return lefts.flatMap((left) => rights.map((right) => [left.itemId, right.itemId]));
}

/**
 * Picks a random outfit from `items` for a persona of `personaType`. Only pieces
 * that can actually be shown on that persona are used (fitted, same persona type,
 * not removed). A jacket is added with probability `jacketChance` when the closet
 * has one. `random` is injectable (returns [0, 1)) so the choice is testable.
 */
export function pickRandomOutfit(
  items: ClothingItem[],
  personaType: PersonaType,
  random: () => number = Math.random,
  jacketChance = 0.5
): RandomOutfit {
  const usable = items.filter(
    (item) => item.active !== false && item.personaType === personaType && isFittedStatus(item)
  );
  const of = (category: ClothingCategory) => usable.filter((item) => item.category === category);

  const shoes = pick(shoeSets(of(ClothingCategory.SHOES)), random);
  const bottom = pick(of(ClothingCategory.BOTTOM), random);
  const top = pick(of(ClothingCategory.TOP), random);
  const jackets = of(ClothingCategory.JACKET);
  // Always draw the dice, so the same `random` sequence gives the same outfit
  // whether or not the closet has a jacket.
  const wantsJacket = random() < jacketChance;
  const jacket = wantsJacket ? pick(jackets, random) : undefined;

  const missing: RandomOutfit['missing'] = [];
  if (!shoes) missing.push('shoes');
  if (!bottom) missing.push('bottom');
  if (!top) missing.push('top');

  const ids = [...(shoes ?? []), bottom?.itemId, top?.itemId, jacket?.itemId].filter(
    (id): id is number => id != null
  );
  return { ids: normalizeShoes(ids, items), missing };
}
