import { ClothingCategory, PersonaStatus } from '../types';
import type { ClothingItem, OutfitItem, PersonaState, PersonaType } from '../types';
import { equippedFromOutfitItems } from '../store/useOutfitStore';
import type { EquippedItemIds } from '../store/useOutfitStore';
import { outfitItemsFromDraft } from '../store/useOutfitDraftStore';

// Persona-eligibility filtering (Task 38, extracted into a shared utility
// by Task 61 so FlatOutfitBuilderPage and OutfitCard can use the same
// logic instead of only the former having it inline).
//
// PersonaRenderer can only show FITTED items matching the persona's type:
// a NOT_FITTED/INELIGIBLE_NO_CUTOUT item has no fitted transform to render,
// and PersonaRenderer's own getItem silently drops a type mismatch (it has
// no knowledge of personaStatus at all). So callers pre-filter with this
// and report what was excluded instead of quietly showing fewer items than
// were selected - the concrete, visible form of open question #7's tradeoff.

export interface PersonaEligibility {
  // Ready to hand straight to PersonaRenderer - eligible items only.
  previewPersona: PersonaState;
  // The items previewPersona was built from (FITTED + matching persona
  // type). Exposed so a caller that already has its own saved slots for
  // these items (OutfitCard) can build its preview from those instead of
  // the slots outfitItemsFromDraft re-derives from category/side.
  eligibleItems: ClothingItem[];
  // Every non-FITTED item (NOT_FITTED + INELIGIBLE_NO_CUTOUT together),
  // regardless of persona type - Task 38's original "ineligible" bucket.
  ineligibleItems: ClothingItem[];
  // Task 46's per-reason split of the above: only NOT_FITTED items can be
  // fitted; INELIGIBLE_NO_CUTOUT has no cutout to fit at all (open
  // question #14) and can only be removed.
  notFittedItems: ClothingItem[];
  noCutoutItems: ClothingItem[];
  // Fitted (or legacy null status) but belonging to the other persona type.
  wrongPersonaItems: ClothingItem[];
}

// An item with no personaStatus at all predates Task 29's column and is
// treated as FITTED - same backfill the V2 migration applied server-side.
const isFittedStatus = (item: ClothingItem): boolean =>
  item.personaStatus == null || item.personaStatus === PersonaStatus.FITTED;

// Task 66 (Phase 9.6): a shoe with no recorded `side` (older items, or any
// created outside the left/right pair flow) has no slot - outfitItemsFromDraft
// can only map side 'left'/'right' to leftShoe/rightShoe - so it never made it
// onto the persona at all. This gives such shoes the same treatment
// usePersonaStore.setEquippedItem already gives them: a legacy single-image
// shoe is treated as the whole pair when both feet are free (PersonaRenderer
// draws it once, using the category's default transform), otherwise it takes
// whichever foot is still empty. Shoes already placed by a recorded slot are
// left alone, and any unsided shoe past the two feet is ignored.
export function applyLegacyShoeFallback(
  equipped: EquippedItemIds,
  eligibleItems: ClothingItem[]
): EquippedItemIds {
  const result = { ...equipped };

  for (const item of eligibleItems) {
    if (item.category !== ClothingCategory.SHOES) continue;
    if (item.side === 'left' || item.side === 'right') continue;
    if (result.leftShoeId === item.itemId || result.rightShoeId === item.itemId) continue;

    if (result.leftShoeId == null && result.rightShoeId == null) {
      result.leftShoeId = item.itemId;
      result.rightShoeId = item.itemId;
    } else if (result.leftShoeId == null) {
      result.leftShoeId = item.itemId;
    } else if (result.rightShoeId == null) {
      result.rightShoeId = item.itemId;
    }
  }

  return result;
}

// Splits `selectedItems` into what can be shown on a `targetPersonaType`
// persona and why the rest can't. `allItems` is the full closet, needed
// because outfitItemsFromDraft looks up each item's category/side by id to
// derive its slot.
export function computePersonaEligibility(
  selectedItems: ClothingItem[],
  allItems: ClothingItem[],
  targetPersonaType: PersonaType
): PersonaEligibility {
  const ineligibleItems = selectedItems.filter(
    (item) => item.personaStatus != null && item.personaStatus !== PersonaStatus.FITTED
  );
  const notFittedItems = selectedItems.filter((item) => item.personaStatus === PersonaStatus.NOT_FITTED);
  const noCutoutItems = selectedItems.filter((item) => item.personaStatus === PersonaStatus.INELIGIBLE_NO_CUTOUT);
  const wrongPersonaItems = selectedItems.filter(
    (item) => isFittedStatus(item) && item.personaType !== targetPersonaType
  );
  const eligibleItems = selectedItems.filter(
    (item) => isFittedStatus(item) && item.personaType === targetPersonaType
  );
  const eligibleIds = eligibleItems.map((item) => item.itemId);

  // outfitItemsFromDraft's output has no outfitItemId (OutfitRequest's
  // create-payload shape); equippedFromOutfitItems expects OutfitItem
  // (the response shape, which does). outfitItemId is never read by
  // equippedFromOutfitItems, so itemId is a safe, harmless placeholder.
  const eligibleOutfitItems: OutfitItem[] = outfitItemsFromDraft(eligibleIds, allItems).map((oi) => ({
    outfitItemId: oi.itemId,
    itemId: oi.itemId,
    slot: oi.slot,
    itemOrder: oi.itemOrder,
  }));

  const previewPersona: PersonaState = {
    type: targetPersonaType,
    ...applyLegacyShoeFallback(equippedFromOutfitItems(eligibleOutfitItems), eligibleItems),
  };

  return { previewPersona, eligibleItems, ineligibleItems, notFittedItems, noCutoutItems, wrongPersonaItems };
}
