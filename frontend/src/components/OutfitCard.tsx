import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Edit2, Trash2, Copy, Play, Calendar, Info, Maximize2 } from 'lucide-react';
import type { Outfit } from '../types';
import { useOutfitStore, equippedFromOutfitItems } from '../store/useOutfitStore';
import { usePersonaStore } from '../store/usePersonaStore';
import { useClothingStore } from '../store/useClothingStore';
import { useNavigate } from 'react-router-dom';
import PersonaRenderer from './PersonaRenderer';

interface OutfitCardProps {
  outfit: Outfit;
}

const OutfitCard: React.FC<OutfitCardProps> = ({ outfit }) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showPersona, setShowPersona] = useState(false);
  const { removeOutfit, duplicateOutfit } = useOutfitStore();
  const { items: closetItems } = useClothingStore();
  const { updatePersona } = usePersonaStore();
  const navigate = useNavigate();

  // Backend items[] -> the category-id-list shape the persona/renderer expect.
  const equippedIds = useMemo(() => equippedFromOutfitItems(outfit.items), [outfit.items]);

  const handleApply = () => {
    updatePersona(equippedIds);
    // Auto-scroll to persona section to see the full look
    const personaEl = document.getElementById('persona');
    if (personaEl) {
      personaEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

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

  const outfitPersona = {
    type: outfit.avatarType,
    ...equippedIds
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
      <div className="relative aspect-[3/4] rounded-[2rem] overflow-hidden border border-white/5 bg-background-secondary shadow-xl transition-all group-hover:shadow-accent/5">
        
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
                  <div key={item.itemId} className={`relative rounded-xl overflow-hidden border border-white/5 bg-black/20 ${equippedItems.length === 1 ? 'col-span-2 row-span-2' : ''}`}>
                    <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                    {idx === 3 && equippedItems.length > 4 && (
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center">
                        <span className="text-white text-[10px] font-black">+{equippedItems.length - 3}</span>
                      </div>
                    )}
                  </div>
                ))}
                {equippedItems.length === 0 && (
                  <div className="col-span-2 row-span-2 flex items-center justify-center opacity-10">
                    <Maximize2 size={40} className="text-white" />
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
              className={`p-2.5 rounded-xl transition-all border ${showPersona ? 'bg-accent text-white border-accent' : 'bg-white/5 hover:bg-white/10 text-white border-white/5'}`}
              title={showPersona ? "Show Items" : "More Info"}
            >
              <Info size={14} />
            </button>
            <button
              onClick={() => duplicateOutfit(outfit)}
              className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-white transition-colors border border-white/5"
              title="Duplicate"
            >
              <Copy size={14} />
            </button>
            <button
              onClick={() => navigate(`/outfits/edit/${outfit.outfitId}`)}
              className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-white transition-colors border border-white/5"
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
              className="w-full py-3 bg-white text-background-main font-black text-[10px] rounded-xl tracking-[0.2em] flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all"
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
              <p className="text-white text-[12px] font-black uppercase tracking-widest mb-2">Delete Outfit?</p>
              <p className="text-white/60 text-[8px] uppercase tracking-widest mb-6 leading-relaxed">
                This action is permanent and cannot be undone.
              </p>
              <div className="flex gap-4 w-full">
                <button
                  onClick={() => removeOutfit(outfit.outfitId)}
                  className="flex-grow py-3 bg-rose-500 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-xl shadow-lg active:scale-95 transition-all"
                >
                  DELETE
                </button>
                <button 
                  onClick={() => setIsDeleting(false)}
                  className="flex-grow py-3 bg-white/10 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-xl border border-white/10 active:scale-95 transition-all"
                >
                  CANCEL
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      <div className="mt-4 px-2 space-y-1">
        <h3 className="text-sm font-bold text-white group-hover:text-accent transition-colors line-clamp-1 uppercase tracking-wider">
          {outfit.name}
        </h3>
        <div className="flex items-center gap-2 opacity-30">
          <Calendar size={10} className="text-text-secondary" />
          <span className="text-[8px] font-black uppercase tracking-widest text-text-secondary">
            {formatDate(outfit.createdAt)}
          </span>
        </div>
      </div>
    </motion.div>
  );
};

export default OutfitCard;
