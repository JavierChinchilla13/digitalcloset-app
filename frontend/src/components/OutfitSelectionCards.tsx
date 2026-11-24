import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import type { ClothingItem } from '../types';
import { pairShoesForDisplay } from '../utils/selectionDisplay';
import CroppedThumbnail from './CroppedThumbnail';
import PersonaBadge from './PersonaBadge';
import { useT } from '../i18n';

// Extracted from FlatOutfitBuilderPage (Task 76 follow-ups; see that file's
// history for the sizing/centering rationale) so the Demo page's selection
// panel can match it exactly instead of re-implementing the same cards -
// both pages show a flat draft selection (useOutfitDraftStore) the same way.
// `showPersonaBadge` is off on the Demo page, which has no persona concept.
interface CardProps {
  item: ClothingItem;
  onRemove: (itemId: number) => void;
  showPersonaBadge?: boolean;
}

export const SelectionCard = ({ item, onRemove, showPersonaBadge = true }: CardProps) => {
  const { t } = useT();
  return (
  <motion.div
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    className="relative w-32 sm:w-36 shrink-0 aspect-[3/4] rounded-xl overflow-hidden bg-ink/5 border border-accent/30 group"
  >
    <CroppedThumbnail imageUrl={item.imageUrl} transform={item.transform} alt={item.name} className="w-full h-full object-cover" />
    {showPersonaBadge && <PersonaBadge item={item} compact />}
    <button
      onClick={() => onRemove(item.itemId)}
      className="absolute top-1.5 right-1.5 p-1 touch:p-2.5 bg-black/60 hover:bg-red-500/80 rounded-full text-white opacity-0 group-hover:opacity-100 touch:opacity-100 transition-opacity"
      title={t('selection.remove')}
      aria-label={t('selection.removeNamed', { name: item.name })}
    >
      <X size={10} />
    </button>
    <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-gradient-to-t from-black/80 to-transparent">
      <p className="text-[10px] font-bold text-white line-clamp-1 uppercase tracking-wider">{item.name}</p>
    </div>
  </motion.div>
  );
};

// Shoes get their own 2-up sub-row (left/right paired via
// pairShoesForDisplay) instead of the generic grid; any unpaired items (no
// recorded side, or an extra pair) fall back to the same denser grid used
// elsewhere, in a secondary row underneath.
export const ShoeSubRow = ({ items, onRemove, showPersonaBadge = true }: { items: ClothingItem[]; onRemove: (itemId: number) => void; showPersonaBadge?: boolean }) => {
  const { left, right, unpaired } = pairShoesForDisplay(items);
  return (
    <div className="space-y-1.5">
      {(left || right) && (
        <div className="flex gap-4 justify-center">
          {left && <SelectionCard item={left} onRemove={onRemove} showPersonaBadge={showPersonaBadge} />}
          {right && <SelectionCard item={right} onRemove={onRemove} showPersonaBadge={showPersonaBadge} />}
        </div>
      )}
      {unpaired.length > 0 && (
        <div className="flex flex-wrap gap-4 justify-center">
          {unpaired.map((item) => (
            <SelectionCard key={item.itemId} item={item} onRemove={onRemove} showPersonaBadge={showPersonaBadge} />
          ))}
        </div>
      )}
    </div>
  );
};
