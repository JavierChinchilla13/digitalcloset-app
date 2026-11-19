import { PersonaStatus, PersonaType } from '../types';
import type { ClothingItem } from '../types';
import { translate } from '../i18n';

// Task 77: the "which persona is this garment for?" sign shown on every
// garment card. Pure, so the wording rules live in one testable place and every
// card in the app says the same thing.
export type PersonaSignTone = 'persona' | 'not-fitted' | 'unassigned';

export interface PersonaSign {
  label: string;   // short text shown on the card
  title: string;   // longer explanation for the tooltip / screen readers
  tone: PersonaSignTone;
}

// Only the two fields the sign depends on, so callers can pass a full
// ClothingItem or anything shaped like one.
type SignSource = Pick<ClothingItem, 'personaType' | 'personaStatus'>;

/**
 * FITTED (or a legacy item with no status): the persona's own display name,
 *   e.g. "M Persona" or whatever the user renamed it to.
 * NOT_FITTED: saved for a persona but never fitted onto it ("Skip Persona
 *   Fitting" in the upload flow) - it can't be drawn on the persona yet.
 * INELIGIBLE_NO_CUTOUT: saved with "Skip Background Removal - Keep Original,
 *   No Persona" - it belongs to no persona at all.
 */
export function personaSign(
  item: SignSource,
  getDisplayName: (type: PersonaType) => string
): PersonaSign {
  const personaName = getDisplayName(item.personaType);

  switch (item.personaStatus) {
    case PersonaStatus.INELIGIBLE_NO_CUTOUT:
      return {
        label: translate('personaSign.unassigned'),
        title: translate('personaSign.unassignedTitle'),
        tone: 'unassigned',
      };
    case PersonaStatus.NOT_FITTED:
      return {
        label: translate('personaSign.notFitted'),
        title: translate('personaSign.notFittedTitle', { name: personaName }),
        tone: 'not-fitted',
      };
    default:
      return {
        label: personaName,
        title: translate('personaSign.fittedTitle', { name: personaName }),
        tone: 'persona',
      };
  }
}
