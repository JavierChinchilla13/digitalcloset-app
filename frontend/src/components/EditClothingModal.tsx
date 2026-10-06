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
import GarmentCleanup, { type CleanupResult } from './FittingTool/GarmentCleanup';
import { retargetForTrim } from '../utils/alphaBounds';
import JacketFittingEditor from './FittingTool/JacketFittingEditor';
import { segmentationService } from '../utils/segmentationService';
import { parseWarpData } from '../utils/warpData';
import { cloudinaryService } from '../api/cloudinaryService';
import { getApiErrorMessage } from '../utils/apiError';

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

  // View State. Task 83: "Open Studio" goes to the Cleanup Studio first (erase
  // leftovers from the cutout), and only its "Finalize & Next" opens the
  // studio - the same order as adding a garment. Jackets then get split into
  // torso / sleeves and open the Modular Jacket Studio ('jacket') instead of
  // Fabric Studio ('studio'); shoes skip cleanup entirely.
  const [view, setView] = useState<'form' | 'cleanup' | 'studio' | 'jacket'>('form');
  // Set once a cleaned image has been uploaded; from then on it replaces the
  // item's image (in Fabric Studio and on save).
  const [cleanedImageUrl, setCleanedImageUrl] = useState<string | null>(null);
  // Jacket sections (torso, sleeves, ...) as uploaded image URLs.
  const [jacketSegments, setJacketSegments] = useState<Record<string, string>>({});
  // What the cleanup screen's busy indicator says; null when idle.
  const [cleanupBusy, setCleanupBusy] = useState<string | null>(null);
  const [cleanupError, setCleanupError] = useState('');

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
      setView('form');
      setCleanedImageUrl(null);
      setJacketSegments({});
      setCleanupBusy(null);
      setCleanupError('');
    }
  }, [item, isOpen]);

  // "Open Studio": cleanup first - except shoes, which have nothing to clean
  // up (they are edited as they are).
  const handleOpenStudio = () => {
    setCleanupError('');
    setView(category === ClothingCategory.SHOES ? 'studio' : 'cleanup');
  };

  // Splits a jacket image into its sections (the same in-browser segmentation
  // the add-garment flow uses), uploads each and opens the Modular Jacket
  // Studio. Returns false when the model found nothing to split.
  const splitJacket = async (blob: Blob): Promise<boolean> => {
    setCleanupBusy('Splitting the jacket into sections...');
    const parts = await segmentationService.segmentJacket(new File([blob], 'jacket.png', { type: 'image/png' }));
    if (parts.size === 0) return false;
    const urls: Record<string, string> = {};
    for (const [partName, partBlob] of parts.entries()) {
      urls[partName] = await cloudinaryService.uploadImage(partBlob);
    }
    setJacketSegments(urls);
    setView('jacket');
    return true;
  };

  // Cleanup's "Finalize & Next" (dataUrl = the picture as exported). The
  // export is also how a loose picture gets cropped to the garment, so the
  // studio's selection box and warp points sit on the garment instead of far
  // out on a wide margin; since the saved fit describes the whole picture, a
  // crop retargets it so the garment looks exactly as before. Nothing to
  // upload when nothing was erased and nothing was cropped. Jackets are split
  // into sections; anything else uploads the picture and opens Fabric Studio on
  // it - uploaded now (not on save) because a warp made in the studio records
  // this image's URL as its "original", which must be a real URL.
  const handleCleanupDone = async (dataUrl: string, result?: CleanupResult) => {
    setCleanupError('');
    try {
      const changed = result ? result.edited || !!result.trim : true;
      if (category === ClothingCategory.JACKET) {
        setCleanupBusy('Preparing the jacket...');
        const source = changed ? dataUrl : cleanedImageUrl ?? item?.imageUrl ?? '';
        const blob = await (await fetch(source)).blob();
        if (await splitJacket(blob)) return;
        // Nothing to split: carry on with a single image below.
      }
      if (changed) {
        setCleanupBusy('Saving image...');
        const blob = await (await fetch(dataUrl)).blob();
        setCleanedImageUrl(await cloudinaryService.uploadImage(blob));
        if (result?.trim && transform) setTransform(retargetForTrim(transform, result.trim));
      }
      setView('studio');
    } catch (err: any) {
      setCleanupError(getApiErrorMessage(err, 'Failed to process the image.', { ownMessages: true }));
    } finally {
      setCleanupBusy(null);
    }
  };

  // Modular Jacket Studio's save: the sections and their fit go in
  // modularData. The item's own image (the closet thumbnail) stays as it is.
  const handleJacketSave = async (data: { name: string; description: string; modularData: string }) => {
    if (!item) return;
    setStatus('updating');
    try {
      await updateItem(item.itemId, {
        name: data.name,
        description: data.description,
        category,
        isModular: true,
        modularData: data.modularData,
        transform: transform ?? item.transform,
        personaStatus: promoteToFittedOnSave ? PersonaStatus.FITTED : undefined
      });
      setStatus('success');
      showToast(`${data.name} updated successfully`, 'success');
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setStatus('error');
      setErrorMessage(getApiErrorMessage(err, 'Failed to update garment.', { ownMessages: true }));
      showToast('Failed to update garment', 'error');
    }
  };

  const handleUpdate = async (overrides?: {
    name: string;
    description: string;
    transform: ClothingTransform;
    imageUrl?: string;
    modularData?: string;
  }) => {
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
        imageUrl: overrides?.imageUrl ?? cleanedImageUrl ?? item.imageUrl,
        // Only sent when the mesh warp changed this session ('' clears it).
        // A cleaned image with no new warp also clears it: the item's old
        // warp record points at the pre-cleanup image, so keeping it would
        // let "Restore Original" bring the erased leftovers back.
        ...(overrides?.modularData !== undefined
          ? { modularData: overrides.modularData }
          : cleanedImageUrl && item.modularData && !item.isModular
            ? { modularData: '' }
            : {}),
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
      setErrorMessage(getApiErrorMessage(err, 'Failed to update garment.', { ownMessages: true }));
      showToast('Failed to update garment', 'error');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-4 md:p-6">
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
            className={`relative bg-background-secondary border border-ink/5 sm:rounded-2xl shadow-lg overflow-hidden transition-all duration-500 ${
              view !== 'form'
                ? 'w-full max-w-7xl h-dvh sm:h-[90dvh]'
                : 'w-full max-w-2xl h-dvh sm:h-auto sm:max-h-[calc(100dvh-2rem)] flex flex-col'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {view === 'form' ? (
              <>
                {/* Header */}
                <div className="flex justify-between items-center p-5 sm:p-8 border-b border-ink/5 shrink-0">
                  <div>
                    <h2 className="text-2xl font-light tracking-tight text-text-primary">Edit Garment</h2>
                    <p className="text-[10px] text-text-secondary font-medium tracking-widest uppercase mt-1 opacity-50">Refining your collection</p>
                  </div>
                  <button 
                    onClick={onClose}
                    className="p-3 hover:bg-ink/5 rounded-full transition-colors text-text-secondary hover:text-text-primary"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="p-5 sm:p-8 space-y-6 sm:space-y-8 flex-1 min-h-0 overflow-y-auto no-scrollbar">
                  {/* Studio Quick Access */}
                  <div className="p-4 sm:p-6 bg-accent/5 border border-accent/20 rounded-3xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-accent/10 rounded-2xl text-accent">
                        <Sparkles size={20} />
                      </div>
                      <div>
                        <h4 className="text-[10px] font-medium uppercase tracking-widest text-text-primary">Fabric Studio</h4>
                        <p className="text-[10px] text-text-secondary uppercase tracking-widest opacity-60">Clean up, resize and reposition garment</p>
                      </div>
                    </div>
                    <button 
                      onClick={handleOpenStudio}
                      className="px-6 py-3.5 bg-accent hover:bg-accent-hover text-on-accent text-[10px] font-medium uppercase tracking-widest rounded-xl transition-all shadow-lg"
                    >
                      Open Studio
                    </button>
                  </div>

                  {/* Category Selector */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-text-secondary uppercase tracking-[0.2em] text-[10px] font-medium">
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
                                ? 'bg-accent/10 border-accent text-accent shadow-lg' 
                                : 'bg-ink/5 border-ink/5 text-text-secondary hover:border-ink/10 hover:bg-ink/10'
                              }
                            `}
                          >
                            <Icon size={20} />
                            <span className="text-[10px] font-medium uppercase tracking-widest">{CATEGORY_LABELS[cat]}</span>
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Name Input */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-text-secondary uppercase tracking-[0.2em] text-[10px] font-medium">
                      <Type size={12} className="text-accent" />
                      <span>Garment Name</span>
                    </div>
                    <input 
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Oversized Cashmere Sweater"
                      className="w-full bg-ink/5 border border-ink/5 rounded-2xl px-6 py-4 text-text-primary placeholder:text-ink/20 focus:outline-none focus:border-accent/50 focus:bg-ink/10 transition-all"
                    />
                  </div>

                  {/* Description Input */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-text-secondary uppercase tracking-[0.2em] text-[10px] font-medium">
                      <AlignLeft size={12} className="text-accent" />
                      <span>Description</span>
                    </div>
                    <textarea 
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Add details about fit, material, or style..."
                      rows={4}
                      className="w-full bg-ink/5 border border-ink/5 rounded-2xl px-6 py-4 text-text-primary placeholder:text-ink/20 focus:outline-none focus:border-accent/50 focus:bg-ink/10 transition-all resize-none"
                    />
                  </div>
                </div>

                {/* Footer */}
                <div className="p-4 sm:p-8 pb-[max(1rem,env(safe-area-inset-bottom))] bg-ink/5 border-t border-ink/5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between shrink-0">
                  <div className="flex items-center gap-3">
                    {status === 'updating' && (
                      <div className="flex items-center gap-2 text-accent">
                        <Loader2 size={16} className="animate-spin" />
                        <span className="text-[10px] font-medium uppercase tracking-widest">Updating...</span>
                      </div>
                    )}
                    {status === 'success' && (
                      <div className="flex items-center gap-2 text-emerald-400">
                        <CheckCircle2 size={16} />
                        <span className="text-[10px] font-medium uppercase tracking-widest">Saved Successfully</span>
                      </div>
                    )}
                    {status === 'error' && (
                      <div className="flex items-center gap-2 text-rose-400">
                        <AlertCircle size={16} />
                        <span className="text-[10px] font-medium uppercase tracking-widest">{errorMessage}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 sm:gap-4">
                    <button 
                      onClick={onClose}
                      className="flex-1 sm:flex-none px-4 sm:px-8 py-4 text-text-secondary hover:text-text-primary text-[10px] font-medium uppercase tracking-widest transition-colors"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={() => handleUpdate()}
                      disabled={status === 'updating' || !name}
                      className={`
                        flex-1 sm:flex-none px-6 sm:px-10 py-4 rounded-full text-[10px] font-medium uppercase tracking-[0.2em] transition-all shadow-md
                        ${status === 'updating' || !name
                          ? 'bg-ink/5 text-ink/20 cursor-not-allowed'
                          : 'bg-accent hover:bg-accent-hover text-on-accent hover:scale-105 active:scale-95'
                        }
                      `}
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              </>
            ) : view === 'cleanup' ? (
              <div className="p-3 md:p-8 h-full relative">
                <GarmentCleanup
                  imageUrl={cleanedImageUrl ?? item?.imageUrl ?? ''}
                  exportMode="image-bounds"
                  onComplete={handleCleanupDone}
                  onBack={() => setView('form')}
                />
                {(cleanupBusy || cleanupError) && (
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 px-5 py-3 rounded-2xl bg-background-secondary border border-ink/10 shadow-lg flex items-center gap-3 text-[10px] font-medium uppercase tracking-widest">
                    {cleanupBusy ? (
                      <>
                        <Loader2 size={14} className="animate-spin text-accent" />
                        <span className="text-text-primary">{cleanupBusy}</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle size={14} className="text-rose-400" />
                        <span className="text-rose-400">{cleanupError}</span>
                      </>
                    )}
                  </div>
                )}
              </div>
            ) : view === 'jacket' ? (
              <div className="p-3 md:p-8 h-full">
                <JacketFittingEditor
                  segments={jacketSegments}
                  personaType={item?.personaType || PersonaType.MALE}
                  initialName={name}
                  initialDescription={description}
                  onSave={handleJacketSave}
                  onBack={() => setView('form')}
                />
              </div>
            ) : (
              <div className="p-3 md:p-8 h-full">
                <FittingEditor
                  imageUrl={cleanedImageUrl ?? item?.imageUrl ?? ''}
                  category={category}
                  personaType={item?.personaType || PersonaType.MALE}
                  initialName={name}
                  initialDescription={description}
                  initialTransform={transform}
                  allowWarp={category === ClothingCategory.TOP && !item?.isModular}
                  initialWarp={cleanedImageUrl ? null : parseWarpData(item?.modularData, item?.isModular)}
                  onBack={() => setView('form')}
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
