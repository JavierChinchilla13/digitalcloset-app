import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  Type,
  AlignLeft,
  Shirt,
  Footprints,
  Watch,
  User,
  ShoppingBag,
  Layers,
  Sparkles
} from 'lucide-react';
import { ClothingCategory, PersonaStatus, PersonaType, type ClothingTransform } from '../types';
import type { ClothingItem } from '../types';
import { useClothingStore } from '../store/useClothingStore';
import { useToast } from './Toast';
import FittingEditor from './FittingTool/FittingEditor';

interface EditClothingModalProps {
  item: ClothingItem | null;
  isOpen: boolean;
  onClose: () => void;
  // Task 45: opt-in, additive-only. When true, a successful save also
  // promotes the item to PersonaStatus.FITTED - used by the flat builder's
  // "Adjust & Fit" entry point (Task 45/46) for NOT_FITTED items. Omitted
  // (the default), this prop changes nothing - ClosetPage's existing edit
  // flow must stay byte-for-byte unaffected.
  promoteToFittedOnSave?: boolean;
}

const CATEGORY_ICONS: Record<ClothingCategory, any> = {
  [ClothingCategory.TOP]: Shirt,
  [ClothingCategory.BOTTOM]: ShoppingBag,
  [ClothingCategory.SHOES]: Footprints,
  [ClothingCategory.JACKET]: User,
  [ClothingCategory.ACCESSORY]: Watch,
  [ClothingCategory.DRESS]: Layers,
};

const CATEGORY_LABELS: Record<ClothingCategory, string> = {
  [ClothingCategory.TOP]: 'Top',
  [ClothingCategory.BOTTOM]: 'Bottom',
  [ClothingCategory.SHOES]: 'Shoes',
  [ClothingCategory.JACKET]: 'Jacket',
  [ClothingCategory.ACCESSORY]: 'Accessory',
  [ClothingCategory.DRESS]: 'Dress',
};

const EditClothingModal: React.FC<EditClothingModalProps> = ({ item, isOpen, onClose, promoteToFittedOnSave }) => {
  const [status, setStatus] = useState<'idle' | 'updating' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const { showToast } = useToast();

  // View State
  const [isStudioOpen, setIsStudioOpen] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ClothingCategory>(ClothingCategory.TOP);
  const [transform, setTransform] = useState<ClothingTransform | undefined>(undefined);

  const { updateItem } = useClothingStore();

  useEffect(() => {
    if (item && isOpen) {
      setName(item.name);
      setDescription(item.description || '');
      setCategory(item.category);
      setTransform(item.transform);
      setStatus('idle');
      setIsStudioOpen(false);
    }
  }, [item, isOpen]);

  const handleUpdate = async (overrides?: { name: string; description: string; transform: ClothingTransform }) => {
    if (!item) return;
    
    const finalName = overrides?.name ?? name;
    const finalDescription = overrides?.description ?? description;
    const finalTransform = overrides?.transform ?? transform;

    if (!finalName) return;

    setStatus('updating');

    try {
      await updateItem(item.itemId, {
        name: finalName,
        description: finalDescription,
        category,
        imageUrl: item.imageUrl,
        transform: finalTransform,
        personaStatus: promoteToFittedOnSave ? PersonaStatus.FITTED : undefined
      });

      setStatus('success');
      showToast(`${finalName} updated successfully`, 'success');
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setStatus('error');
      setErrorMessage(err.message || 'Failed to update garment.');
      showToast('Failed to update garment', 'error');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-background-main/80 backdrop-blur-xl"
          />

          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className={`relative bg-background-secondary border border-white/5 rounded-[2.5rem] shadow-2xl overflow-hidden transition-all duration-500 ${
              isStudioOpen ? 'w-full max-w-6xl h-[90vh]' : 'w-full max-w-2xl'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {!isStudioOpen ? (
              <>
                {/* Header */}
                <div className="flex justify-between items-center p-8 border-b border-white/5">
                  <div>
                    <h2 className="text-2xl font-light tracking-tighter text-white uppercase">Edit Garment</h2>
                    <p className="text-[10px] text-text-secondary font-black tracking-widest uppercase mt-1 opacity-50">Refining your collection</p>
                  </div>
                  <button 
                    onClick={onClose}
                    className="p-3 hover:bg-white/5 rounded-full transition-colors text-text-secondary hover:text-white"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto no-scrollbar">
                  {/* Studio Quick Access */}
                  <div className="p-6 bg-accent/5 border border-accent/20 rounded-3xl flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-accent/10 rounded-2xl text-accent">
                        <Sparkles size={20} />
                      </div>
                      <div>
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-white">Fabric Studio</h4>
                        <p className="text-[8px] text-text-secondary uppercase tracking-widest opacity-60">Resize and reposition garment</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setIsStudioOpen(true)}
                      className="px-6 py-3 bg-accent hover:bg-accent-hover text-white text-[8px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-accent/20"
                    >
                      Open Studio
                    </button>
                  </div>

                  {/* Category Selector */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-text-secondary uppercase tracking-[0.2em] text-[10px] font-black">
                      <Shirt size={12} className="text-accent" />
                      <span>Category</span>
                    </div>
                    <div className="flex flex-wrap justify-center gap-3">
                      {Object.values(ClothingCategory)
                        .map((cat) => {
                        const Icon = CATEGORY_ICONS[cat];
                        const isSelected = category === cat;
                        return (
                          <motion.button
                            key={cat}
                            whileHover={{ y: -2 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setCategory(cat)}
                            className={`
                              flex flex-col items-center justify-center gap-3 p-4 w-24 rounded-2xl border transition-all
                              ${isSelected 
                                ? 'bg-accent/10 border-accent text-accent shadow-lg shadow-accent/20' 
                                : 'bg-white/5 border-white/5 text-text-secondary hover:border-white/10 hover:bg-white/10'
                              }
                            `}
                          >
                            <Icon size={20} />
                            <span className="text-[8px] font-black uppercase tracking-widest">{CATEGORY_LABELS[cat]}</span>
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Name Input */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-text-secondary uppercase tracking-[0.2em] text-[10px] font-black">
                      <Type size={12} className="text-accent" />
                      <span>Garment Name</span>
                    </div>
                    <input 
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Oversized Cashmere Sweater"
                      className="w-full bg-white/5 border border-white/5 rounded-2xl px-6 py-4 text-white placeholder:text-white/20 focus:outline-none focus:border-accent/50 focus:bg-white/10 transition-all"
                    />
                  </div>

                  {/* Description Input */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-text-secondary uppercase tracking-[0.2em] text-[10px] font-black">
                      <AlignLeft size={12} className="text-accent" />
                      <span>Description</span>
                    </div>
                    <textarea 
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Add details about fit, material, or style..."
                      rows={4}
                      className="w-full bg-white/5 border border-white/5 rounded-2xl px-6 py-4 text-white placeholder:text-white/20 focus:outline-none focus:border-accent/50 focus:bg-white/10 transition-all resize-none"
                    />
                  </div>
                </div>

                {/* Footer */}
                <div className="p-8 bg-black/20 border-t border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {status === 'updating' && (
                      <div className="flex items-center gap-2 text-accent">
                        <Loader2 size={16} className="animate-spin" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Updating...</span>
                      </div>
                    )}
                    {status === 'success' && (
                      <div className="flex items-center gap-2 text-emerald-400">
                        <CheckCircle2 size={16} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Saved Successfully</span>
                      </div>
                    )}
                    {status === 'error' && (
                      <div className="flex items-center gap-2 text-rose-400">
                        <AlertCircle size={16} />
                        <span className="text-[10px] font-black uppercase tracking-widest">{errorMessage}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-4">
                    <button 
                      onClick={onClose}
                      className="px-8 py-4 text-text-secondary hover:text-white text-[10px] font-black uppercase tracking-widest transition-colors"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={() => handleUpdate()}
                      disabled={status === 'updating' || !name}
                      className={`
                        px-10 py-4 rounded-full text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-xl
                        ${status === 'updating' || !name
                          ? 'bg-white/5 text-white/20 cursor-not-allowed'
                          : 'bg-accent hover:bg-accent-hover text-white shadow-accent/20 hover:scale-105 active:scale-95'
                        }
                      `}
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="p-8 h-full">
                <FittingEditor 
                  imageUrl={item?.imageUrl || ''}
                  category={category}
                  personaType={item?.personaType || PersonaType.MALE}
                  initialName={name}
                  initialDescription={description}
                  initialTransform={transform}
                  onBack={() => setIsStudioOpen(false)}
                  onSave={handleUpdate}
                />
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default EditClothingModal;
