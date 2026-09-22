import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Edit2, Trash2, Copy, Play, Calendar, Info, Maximize2, AlertTriangle } from 'lucide-react';
import type { ClothingItem, Outfit } from '../types';
import { useOutfitStore, equippedFromOutfitItems } from '../store/useOutfitStore';
import { usePersonaStore } from '../store/usePersonaStore';
import { useClothingStore } from '../store/useClothingStore';
import { useOutfitDraftStore, draftFromOutfitItems } from '../store/useOutfitDraftStore';
import { useNavigate } from 'react-router-dom';
import PersonaRenderer from './PersonaRenderer';
import { computePersonaEligibility, applyLegacyShoeFallback } from '../utils/personaEligibility';

interface OutfitCardProps {
  outfit: Outfit;
}

const OutfitCard: React.FC<OutfitCardProps> = ({ outfit }) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showPersona, setShowPersona] = useState(false);
  const { removeOutfit, duplicateOutfit } = useOutfitStore();
  const { items: closetItems } = useClothingStore();
  const { updatePersona } = usePersonaStore();
  const { setDraft } = useOutfitDraftStore();
  const navigate = useNavigate();

  // Backend items[] -> the category-id-list shape the persona/renderer expect.
  const equippedIds = useMemo(() => equippedFromOutfitItems(outfit.items), [outfit.items]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Find actual item objects to get images
  const equippedItems = useMemo(() => {
    const ids = [
      ...equippedIds.topIds,
      ...equippedIds.bottomIds,
      ...equippedIds.jacketIds,
      ...equippedIds.accessoryIds,
      ...equippedIds.dressIds,
      equippedIds.leftShoeId,
      equippedIds.rightShoeId
    ].filter(Boolean);

    return closetItems.filter(item => ids.includes(item.itemId));
  }, [equippedIds, closetItems]);

  // Task 62 (Phase 9.5): the persona preview used to hand every item in the
  // outfit straight to PersonaRenderer, which only drops a persona-type
  // mismatch - it knows nothing about personaStatus, so a NOT_FITTED or
  // INELIGIBLE_NO_CUTOUT item rendered anyway (badly) with no warning. Now
  // the same eligibility rules the flat builder uses (Task 61) decide what
  // is shown, and the rest is reported via the note under the card.
  // The preview persona is the outfit's own avatarType, as before.
  const eligibility = useMemo(() => {
    const byId = new Map(closetItems.map((item) => [item.itemId, item]));
    const outfitClothing = [...outfit.items]
      .sort((a, b) => (a.itemOrder ?? 0) - (b.itemOrder ?? 0))
      .map((oi) => byId.get(oi.itemId))
      .filter((item): item is ClothingItem => !!item);
    return computePersonaEligibility(outfitClothing, closetItems, outfit.avatarType);
  }, [outfit.items, outfit.avatarType, closetItems]);

  const hiddenCount = eligibility.ineligibleItems.length + eligibility.wrongPersonaItems.length;
  const hiddenReasons = [
    eligibility.ineligibleItems.length > 0 && `${eligibility.ineligibleItems.length} not fitted`,
    eligibility.wrongPersonaItems.length > 0 && `${eligibility.wrongPersonaItems.length} for the other persona`,
  ].filter(Boolean).join(', ');

  // Built from the outfit's own saved slots (filtered to the eligible
  // items) rather than eligibility.previewPersona, which re-derives slots
  // from category/side - an older outfit's shoe with no recorded side
  // would lose its saved leftShoe/rightShoe slot that way.
  // Task 66: shoes with no recorded side/slot get the legacy-pair fallback,
  // same as the flat builder's preview.
  const outfitPersona = useMemo(() => {
    const eligibleIds = new Set(eligibility.eligibleItems.map((item) => item.itemId));
    return {
      type: outfit.avatarType,
      ...applyLegacyShoeFallback(
        equippedFromOutfitItems(outfit.items.filter((oi) => eligibleIds.has(oi.itemId))),
        eligibility.eligibleItems
      ),
    };
  }, [eligibility, outfit.items, outfit.avatarType]);

  // "Wear Style" (Task 63, Phase 9.5). This used to write the older
  // equip-id lists and then scroll to #persona - an element that only
  // exists on the orphaned /dashboard, so from /outfits it silently did
  // nothing visible. Now it takes the user to Attire ("/", the flat builder)
  // with the outfit loaded and the persona preview already on
  // (open question #22).
  //  - The outfit's items go into the flat builder's draft (its only source
  //    of selection - it never reads the equip lists), whole outfit rather
  //    than just the eligible items, so anything that can't be shown on
  //    the persona is visible there and fixable through the builder's own
  //    Mark as Fitted / Adjust & Fit note.
  //  - The equip lists are still written, eligible items only, because
  //    /closet's "Equipped" highlight (ClothingCard) still reads them.
  //    outfitPersona also carries the outfit's avatarType, so the active
  //    persona switches to it and the preview isn't for the wrong persona.
  const handleApply = () => {
    updatePersona(outfitPersona);
    setDraft(draftFromOutfitItems(outfit.items));
    navigate('/', { state: { showPersonaPreview: true } });
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ y: -8 }}
      className="group relative"
    >
      <div className="relative aspect-[3/4] rounded-xl overflow-hidden border border-ink/5 bg-background-secondary shadow-md transition-all">
        
        {/* Main Content Area */}
        <div className="w-full h-full p-4 flex flex-col items-center justify-center">
          <AnimatePresence mode="wait">
            {!showPersona ? (
              <motion.div 
                key="grid"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="grid grid-cols-2 gap-2 w-full h-full"
              >
                {equippedItems.slice(0, 4).map((item, idx) => (
                  <div key={item.itemId} className={`relative rounded-xl overflow-hidden border border-ink/5 bg-ink/5 ${equippedItems.length === 1 ? 'col-span-2 row-span-2' : ''}`}>
                    <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                    {idx === 3 && equippedItems.length > 4 && (
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center">
                        <span className="text-white text-[10px] font-medium">+{equippedItems.length - 3}</span>
                      </div>
                    )}
                  </div>
                ))}
                {equippedItems.length === 0 && (
                  <div className="col-span-2 row-span-2 flex items-center justify-center opacity-10">
                    <Maximize2 size={40} className="text-text-primary" />
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div 
                key="persona"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="w-full h-full scale-[0.6] origin-center translate-y-[-5%]"
              >
                <PersonaRenderer persona={outfitPersona} className="h-full" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        {/* Actions Overlay */}
        <div className="absolute inset-0 bg-background-main/60 opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col justify-between p-6 backdrop-blur-[2px]">
          <div className="flex justify-end gap-2">
            <button 
              onClick={() => setShowPersona(!showPersona)}
              className={`p-2.5 rounded-xl transition-all border ${showPersona ? 'bg-accent text-on-accent border-accent' : 'bg-ink/5 hover:bg-ink/10 text-text-primary border-ink/5'}`}
              title={showPersona ? "Show Items" : "More Info"}
            >
              <Info size={14} />
            </button>
            <button
              onClick={() => duplicateOutfit(outfit)}
              className="p-2.5 bg-ink/5 hover:bg-ink/10 rounded-xl text-text-primary transition-colors border border-ink/5"
              title="Duplicate"
            >
              <Copy size={14} />
            </button>
            <button
              onClick={() => navigate(`/outfits/flat/edit/${outfit.outfitId}`)}
              className="p-2.5 bg-ink/5 hover:bg-ink/10 rounded-xl text-text-primary transition-colors border border-ink/5"
              title="Edit"
            >
              <Edit2 size={14} />
            </button>
            <button 
              onClick={() => setIsDeleting(true)}
              className="p-2.5 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white rounded-xl transition-all border border-rose-500/10"
              title="Delete"
            >
              <Trash2 size={14} />
            </button>
          </div>
          
          <div className="space-y-3">
            <button 
              onClick={handleApply}
              className="w-full py-3 bg-ink text-background-main font-medium text-[10px] rounded-xl tracking-[0.2em] flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all"
            >
              <Play size={12} fill="currentColor" />
              WEAR STYLE
            </button>
          </div>
        </div>

        {/* Delete Confirmation Overlay */}
        <AnimatePresence>
          {isDeleting && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-20 bg-rose-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center"
            >
              <div className="bg-rose-500/20 p-4 rounded-full mb-4">
                <Trash2 size={24} className="text-rose-500" />
              </div>
              <p className="text-text-primary text-[12px] font-medium uppercase tracking-widest mb-2">Delete Outfit?</p>
              <p className="text-ink/60 text-[10px] uppercase tracking-widest mb-6 leading-relaxed">
                This action is permanent and cannot be undone.
              </p>
              <div className="flex gap-4 w-full">
                <button
                  onClick={() => removeOutfit(outfit.outfitId)}
                  className="flex-grow py-3 bg-rose-500 text-white text-[10px] font-medium uppercase tracking-[0.2em] rounded-xl shadow-lg active:scale-95 transition-all"
                >
                  DELETE
                </button>
                <button 
                  onClick={() => setIsDeleting(false)}
                  className="flex-grow py-3 bg-ink/10 text-text-primary text-[10px] font-medium uppercase tracking-[0.2em] rounded-xl border border-ink/10 active:scale-95 transition-all"
                >
                  CANCEL
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      <div className="mt-4 px-2 space-y-1">
        <h3 className="text-sm font-bold text-text-primary group-hover:text-accent transition-colors line-clamp-1 uppercase tracking-wider">
          {outfit.name}
        </h3>
        <div className="flex items-center gap-2 opacity-30">
          <Calendar size={10} className="text-text-secondary" />
          <span className="text-[10px] font-medium uppercase tracking-widest text-text-secondary">
            {formatDate(outfit.createdAt)}
          </span>
        </div>
        {/* Task 62: kept minimal on purpose (open question #23) - the full
            Mark-as-Fitted / Adjust & Fit actions live in the flat builder
            (Tasks 44-46), so this just says something is hidden and links
            there instead of duplicating them into every card. Lives here,
            not inside the image, because the hover overlay covers the
            whole image and would swallow the click. */}
        {showPersona && hiddenCount > 0 && (
          <button
            onClick={() => navigate(`/outfits/flat/edit/${outfit.outfitId}`)}
            title={`${hiddenReasons} - open in the editor to fix`}
            className="flex items-center gap-1.5 pt-1 text-[10px] font-medium uppercase tracking-widest text-amber-400 hover:text-amber-300 transition-colors"
          >
            <AlertTriangle size={10} />
            {hiddenCount} {hiddenCount === 1 ? 'item' : 'items'} hidden · Fix
          </button>
        )}
      </div>
    </motion.div>
  );
};

export default OutfitCard;
