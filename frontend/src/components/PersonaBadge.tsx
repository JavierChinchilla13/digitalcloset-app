import type { ClothingItem } from '../types';
import { useClothingStore } from '../store/useClothingStore';
import { usePersonaSettingsStore } from '../store/usePersonaSettingsStore';
import { personaSign } from '../utils/personaSign';
import type { PersonaSignTone } from '../utils/personaSign';

// Task 77: the persona sign every garment card carries. Always visible (never
// only on hover): which persona the garment is for, or "Not fitted" /
// "Unassigned" when it isn't on one. Meant to be dropped into the top-left
// corner of a thumbnail (the parent must be `relative`), where the favourite
// star (top-right) and the hover overlays leave it alone.
interface PersonaBadgeProps {
  item: Pick<ClothingItem, 'personaType' | 'personaStatus'>;
  // Smaller text/padding for the dense cards (selection panel, pickers).
  compact?: boolean;
  // Set false when the parent already positions it (e.g. inside a flex row).
  positioned?: boolean;
}

// Dot colour = the state at a glance; the pill itself stays the same dark
// glass every other overlay pill in the app uses, so it reads on any photo.
const DOT_BY_TONE: Record<PersonaSignTone, string> = {
  persona: 'bg-accent',
  'not-fitted': 'bg-amber-400',
  unassigned: 'bg-zinc-400',
};

const PersonaBadge = ({ item, compact = false, positioned = true }: PersonaBadgeProps) => {
  // Subscribing to displayNames (not just the getter) re-renders the badge
  // when the user's custom names finish loading or change.
  usePersonaSettingsStore((state) => state.displayNames);
  const getDisplayName = usePersonaSettingsStore((state) => state.getDisplayName);
  const sign = personaSign(item, getDisplayName);

  return (
    <span
      title={sign.title}
      aria-label={sign.title}
      data-persona-sign={sign.tone}
      className={`
        ${positioned ? 'absolute top-1.5 left-1.5 z-10' : ''}
        max-w-[85%] inline-flex items-center gap-1.5 rounded-full bg-black/60 backdrop-blur-sm text-white
        font-medium uppercase tracking-widest whitespace-nowrap
        ${compact ? 'px-1.5 py-0.5 text-[8px]' : 'px-2 py-1 text-[10px]'}
      `}
    >
      <span className={`shrink-0 rounded-full ${compact ? 'w-1 h-1' : 'w-1.5 h-1.5'} ${DOT_BY_TONE[sign.tone]}`} />
      <span className="truncate">{sign.label}</span>
    </span>
  );
};

// For tiles that only know an itemId (a category's item list comes back as
// {itemId, itemName, imageUrl}, without persona info): look the full garment up
// in the closet store. Renders nothing until the closet has loaded / if the
// garment no longer exists, rather than showing a wrong sign.
export const ItemPersonaBadge = ({ itemId, compact }: { itemId: number; compact?: boolean }) => {
  const item = useClothingStore((state) => state.items.find((i) => i.itemId === itemId));
  if (!item) return null;
  return <PersonaBadge item={item} compact={compact} />;
};

export default PersonaBadge;
