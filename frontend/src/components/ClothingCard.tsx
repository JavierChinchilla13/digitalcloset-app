import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shirt, Info, Edit2, Trash2, Star, Check, X } from 'lucide-react';
import type { ClothingItem, PersonaState } from '../types';
import { usePersonaStore } from '../store/usePersonaStore';
import { useClothingStore } from '../store/useClothingStore';

interface ClothingCardProps {
  item: ClothingItem;
  onViewDetails: (item: ClothingItem) => void;
  onEdit: (item: ClothingItem) => void;
  onDelete: (item: ClothingItem) => void;
  showManagement?: boolean;
}

const ClothingCard: React.FC<ClothingCardProps> = ({ 
  item, 
  onViewDetails,
  onEdit,
  onDelete,
  showManagement = false
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const { setEquippedItem, persona } = usePersonaStore();
  const { toggleFavorite } = useClothingStore();

  const isEquipped = useMemo(() => {
    if (item.category === 'SHOES') {
      return persona.leftShoeId === item.itemId || persona.rightShoeId === item.itemId;
    }
    
    const keyMap: Record<string, keyof PersonaState> = {
      'TOP': 'topIds',
      'BOTTOM': 'bottomIds',
      'JACKET': 'jacketIds',
      'DRESS': 'dressIds',
      'ACCESSORY': 'accessoryIds',
    };
    
    const key = keyMap[item.category];
    if (!key) return false;
    
    const ids = persona[key];
    return Array.isArray(ids) && ids.includes(item.itemId);
  }, [persona, item]);

  const handleEquip = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDeleting) return;
    setEquippedItem(item);
    
    if (!isEquipped) {
      // Auto-scroll to persona section to see the change
      const personaEl = document.getElementById('persona');
      if (personaEl) {
        personaEl.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  const handleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFavorite(item.itemId);
  };

  const handleConfirmDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(item);
    setIsDeleting(false);
  };

  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.02 }}
      className="flex-shrink-0 w-40 md:w-48 group cursor-pointer"
      onClick={handleEquip}
    >
      <div className={`
        relative aspect-[3/4] rounded-xl overflow-hidden mb-3 border transition-all duration-300
        ${isEquipped 
          ? 'border-accent ring-2 ring-accent/20 shadow-lg shadow-accent/10' 
          : 'border-white/5 bg-white/5 hover:border-white/20'
        }
      `}>
        <img 
          src={item.imageUrl} 
          alt={item.name}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
        />
        
        {/* Favorite Star (Always visible if favorite, otherwise on hover) */}
        <button
          onClick={handleFavorite}
          className={`
            absolute top-2 right-2 p-1.5 rounded-full backdrop-blur-md transition-all z-10
            ${item.isFavorite 
              ? 'bg-yellow-500 text-white scale-100 opacity-100' 
              : 'bg-black/40 text-white/40 opacity-0 group-hover:opacity-100 hover:text-yellow-500'
            }
          `}
        >
          <Star size={10} fill={item.isFavorite ? "currentColor" : "none"} strokeWidth={3} />
        </button>

        {/* Overlay Actions */}
        <div className="absolute inset-0 bg-background-main/60 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col items-center justify-center gap-3">
          <div className="flex gap-2">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onViewDetails(item);
              }}
              className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors border border-white/10"
              title="Details"
            >
              <Info size={14} />
            </button>
            
            {showManagement && (
              <>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(item);
                  }}
                  className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors border border-white/10"
                  title="Edit"
                >
                  <Edit2 size={14} />
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsDeleting(true);
                  }}
                  className="p-2 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white rounded-lg transition-all border border-rose-500/10"
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </>
            )}
          </div>

          <div className={`
            flex items-center gap-2 px-3 py-1.5 rounded-full transition-all text-[8px] font-black uppercase tracking-widest
            ${isEquipped ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'bg-white/10 text-white/50'}
          `}>
            <Shirt size={10} />
            <span>{isEquipped ? 'Equipped' : 'Wear'}</span>
          </div>
        </div>

        {/* Delete Confirmation Overlay */}
        <AnimatePresence>
          {isDeleting && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="absolute inset-0 z-20 bg-rose-950/90 backdrop-blur-md flex flex-col items-center justify-center p-4 text-center"
            >
              <Trash2 size={20} className="text-rose-500 mb-2" />
              <p className="text-white text-[9px] font-black uppercase tracking-widest mb-4">Permanent Delete?</p>
              <div className="flex gap-2 w-full">
                <button 
                  onClick={handleConfirmDelete}
                  className="flex-grow py-2 bg-rose-500 text-white text-[8px] font-black uppercase tracking-[0.2em] rounded-lg shadow-lg active:scale-95 transition-all"
                >
                  DELETE
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsDeleting(false);
                  }}
                  className="flex-grow py-2 bg-white/10 text-white text-[8px] font-black uppercase tracking-[0.2em] rounded-lg border border-white/10 active:scale-95 transition-all"
                >
                  CANCEL
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Category Tag (Mini) */}
        <div className="absolute top-2 left-2">
          <span className="px-2 py-0.5 bg-black/40 backdrop-blur-md text-white text-[7px] font-black tracking-widest uppercase rounded-full border border-white/10">
            {item.category}
          </span>
        </div>
      </div>

      <div className="px-1">
        <h3 className={`
          text-[10px] font-bold tracking-tight line-clamp-1 transition-colors
          ${isEquipped ? 'text-accent' : 'text-white group-hover:text-accent'}
        `}>
          {item.name}
        </h3>
        <p className="text-[8px] text-text-secondary font-black tracking-widest uppercase opacity-40 mt-0.5">
          {item.category}
        </p>
      </div>
    </motion.div>
  );
};

export default ClothingCard;
