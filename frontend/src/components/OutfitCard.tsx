import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Edit2, Trash2, Copy, Play, Calendar, Info, Maximize2, AlertTriangle, Star, MoreHorizontal } from 'lucide-react';
import type { ClothingItem, Outfit } from '../types';

const MAIN_OUTFIT_EXPLAINER = "Your main outfit is the one shown first on Showcase and the one Attire opens automatically so you can keep refining it.";
import { useOutfitStore, equippedFromOutfitItems } from '../store/useOutfitStore';
import { usePersonaStore } from '../store/usePersonaStore';
import { useClothingStore } from '../store/useClothingStore';
import { useOutfitDraftStore, draftFromOutfitItems } from '../store/useOutfitDraftStore';
import { layerOrderFromOutfitItems } from '../utils/layerOrder';
import { useNavigate } from 'react-router-dom';
import PersonaRenderer from './PersonaRenderer';
import CroppedThumbnail from './CroppedThumbnail';
import { computePersonaEligibility, buildOutfitPersona } from '../utils/personaEligibility';
import { useSafeAction } from '../hooks/useSafeAction';

interface OutfitCardProps {
  outfit: Outfit;
}

const OutfitCard: React.FC<OutfitCardProps> = ({ outfit }) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showPersona, setShowPersona] = useState(false);
  // Touch screens only: the "..." menu with the less common actions (see below).
  const [menuOpen, setMenuOpen] = useState(false);
  const { removeOutfit, duplicateOutfit, mainOutfitId, setMainOutfit } = useOutfitStore();
  // Task 78: is this the account's main outfit?
  const isMain = mainOutfitId === outfit.outfitId;
  const runSafely = useSafeAction();
  const { items: closetItems } = useClothingStore();
  const { updatePersona } = usePersonaStore();
  const { setDraft } = useOutfitDraftStore();
  const navigate = useNavigate();

  // Backend items[] -> the category-id-list shape the persona/renderer expect.
  const equippedIds = useMemo(() => equippedFromOutfitItems(outfit.items), [outfit.items]);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
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

  // Task 75: extracted into utils/personaEligibility.ts's buildOutfitPersona
  // so the new Outfit Showcase page can build the same preview without
  // reimplementing it - see that function's own comment for why it's built
  // from the outfit's own saved slots rather than eligibility.previewPersona.
  const outfitPersona = useMemo(() => buildOutfitPersona(outfit, closetItems), [outfit, closetItems]);

  // "Wear Style" (Task 63, Phase 9.5). This used to write the older
  // equip-id lists and then scroll to #persona - an element that only
  // existed on the (since removed) dashboard, so from /outfits it silently did
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
    setDraft(draftFromOutfitItems(outfit.items), layerOrderFromOutfitItems(outfit.items));
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
      <div className={`relative aspect-[3/4] rounded-xl overflow-hidden bg-background-secondary shadow-md transition-all border ${
        isMain ? 'border-accent ring-2 ring-accent/30' : 'border-ink/5'
      }`}>
        
        {/* Task 78 follow-up: was a small black-glass pill, the same weight as
            every other overlay badge in the app - too easy to miss. Solid accent +
            the card's own ring (below) make it unmistakable even before hovering. */}
        {isMain && (
          <span
            data-testid="main-outfit-tag"
            title={MAIN_OUTFIT_EXPLAINER}
            className="absolute top-3 left-3 z-10 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent text-on-accent shadow-md text-[9px] font-medium tracking-[0.2em] uppercase"
          >
            <Star size={10} fill="currentColor" /> Main
          </span>
        )}

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
                    <CroppedThumbnail imageUrl={item.imageUrl} transform={item.transform} alt={item.name} className="w-full h-full object-cover" />
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
        <div className="absolute inset-0 bg-background-main/60 opacity-0 group-hover:opacity-100 touch:hidden transition-all duration-300 flex flex-col justify-between p-6 backdrop-blur-[2px]">
          <div className="flex justify-end gap-2">
            <button 
              onClick={() => setShowPersona(!showPersona)}
              className={`p-2.5 rounded-xl transition-all border ${showPersona ? 'bg-accent text-on-accent border-accent' : 'bg-ink/5 hover:bg-ink/10 text-text-primary border-ink/5'}`}
              title={showPersona ? "Show Items" : "More Info"}
            >
              <Info size={14} />
            </button>
            <button
              onClick={() => runSafely(() => setMainOutfit(outfit.outfitId), "Couldn't set your main outfit")}
              disabled={isMain}
              className={`p-2.5 rounded-xl transition-all border disabled:pointer-events-none ${isMain ? 'bg-accent text-on-accent border-accent' : 'bg-ink/5 hover:bg-ink/10 text-text-primary border-ink/5'}`}
              title={isMain ? MAIN_OUTFIT_EXPLAINER : `Set as main outfit - ${MAIN_OUTFIT_EXPLAINER}`}
            >
              <Star size={14} fill={isMain ? 'currentColor' : 'none'} />
            </button>
            <button
              onClick={() => runSafely(() => duplicateOutfit(outfit), "Couldn't duplicate this outfit")}
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
                  onClick={async () => {
                    // Only close the confirm prompt on success - on failure the
                    // toast explains and the user can retry from here.
                    if (await runSafely(() => removeOutfit(outfit.outfitId), "Couldn't delete this outfit")) {
                      setIsDeleting(false);
                    }
                  }}
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

      {/* Task 92: touch screens have no hover, so the overlay's actions live here: Wear
          style and Set-as-main stay one tap away, the rest are behind "...". */}
      <div className="hidden touch:block relative mt-3">
        <div className="flex gap-2">
          <button
            onClick={handleApply}
            className="flex-1 h-10 rounded-xl bg-ink text-background-main font-medium text-[10px] tracking-[0.15em] flex items-center justify-center gap-1.5 active:scale-95 transition-all"
          >
            <Play size={12} fill="currentColor" /> WEAR
          </button>
          <button
            onClick={() => runSafely(() => setMainOutfit(outfit.outfitId), "Couldn't set your main outfit")}
            disabled={isMain}
            aria-label={isMain ? 'Main outfit' : 'Set as main outfit'}
            className={`w-10 h-10 shrink-0 flex items-center justify-center rounded-xl border disabled:pointer-events-none ${isMain ? 'bg-accent text-on-accent border-accent' : 'bg-ink/5 text-text-primary border-ink/10'}`}
          >
            <Star size={16} fill={isMain ? 'currentColor' : 'none'} />
          </button>
          <button
            onClick={() => setMenuOpen((open) => !open)}
            aria-label="More actions"
            aria-expanded={menuOpen}
            className="w-10 h-10 shrink-0 flex items-center justify-center rounded-xl border border-ink/10 bg-ink/5 text-text-primary"
          >
            <MoreHorizontal size={16} />
          </button>
        </div>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(false)} />
            <div role="menu" className="absolute right-0 bottom-full mb-2 w-44 z-30 rounded-xl bg-background-secondary border border-ink/10 shadow-lg p-1.5">
              {[
                { label: showPersona ? 'Show items' : 'On persona', icon: Info, run: () => setShowPersona(!showPersona) },
                { label: 'Duplicate', icon: Copy, run: () => runSafely(() => duplicateOutfit(outfit), "Couldn't duplicate this outfit") },
                { label: 'Edit', icon: Edit2, run: () => navigate(`/outfits/flat/edit/${outfit.outfitId}`) },
                { label: 'Delete', icon: Trash2, run: () => setIsDeleting(true), danger: true },
              ].map(({ label, icon: Icon, run, danger }) => (
                <button
                  key={label}
                  role="menuitem"
                  onClick={() => { setMenuOpen(false); run(); }}
                  className={`w-full min-h-11 flex items-center gap-3 px-3 rounded-lg text-[10px] font-medium uppercase tracking-widest ${danger ? 'text-rose-500' : 'text-text-primary'} active:bg-ink/10`}
                >
                  <Icon size={14} /> {label}
                </button>
              ))}
            </div>
          </>
        )}
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
