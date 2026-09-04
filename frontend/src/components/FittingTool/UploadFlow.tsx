import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Upload, 
  Loader2, 
  Shirt, 
  Footprints, 
  Watch, 
  User, 
  ShoppingBag,
  Layers,
  Sparkles,
  AlertCircle,
  X
} from 'lucide-react';
import { ClothingCategory, PersonaType, PersonaStatus, type ClothingTransform, type ClothingItem } from '../../types';
import { useClothingStore } from '../../store/useClothingStore';
import { useCollectionStore } from '../../store/useCollectionStore';
import CategoryPicker from '../CategoryPicker';
import { cloudinaryService } from '../../api/cloudinaryService';
import { bgRemovalService, optimizeImage } from '../../lib/background-removers';
import { segmentationService } from '../../utils/segmentationService';
import { DEFAULT_TRANSFORMS } from './Presets';
import FittingEditor from './FittingEditor';

import ShoeSymmetryCheck from './ShoeSymmetryCheck';
import ShoeFittingEditor from './ShoeFittingEditor';
import JacketSegmentationTool from './JacketSegmentationTool';
import JacketFittingEditor from './JacketFittingEditor';
import GarmentCleanup from './GarmentCleanup';

interface UploadFlowProps {
  isOpen: boolean;
  onClose: () => void;
}

type Step = 'UPLOAD' | 'CONFIG' | 'PROCESSING' | 'PREVIEW' | 'FITTING' | 'SHOE_SYMMETRY' | 'SHOE_UPLOAD_RIGHT' | 'SHOE_FITTING' | 'JACKET_SEGMENTATION' | 'JACKET_FITTING' | 'GARMENT_CLEANUP' | 'SKIP_PERSONA';

const CATEGORY_ICONS: Record<ClothingCategory, React.ElementType> = {
  [ClothingCategory.TOP]: Shirt,
  [ClothingCategory.BOTTOM]: ShoppingBag,
  [ClothingCategory.SHOES]: Footprints,
  [ClothingCategory.JACKET]: User,
  [ClothingCategory.ACCESSORY]: Watch,
  [ClothingCategory.DRESS]: Layers,
};

const UploadFlow: React.FC<UploadFlowProps> = ({ isOpen, onClose }) => {
  const [step, setStep] = useState<Step>('UPLOAD');
  const [file, setFile] = useState<File | null>(null);
  
  // Shoe Specific State
  const [rightFile, setRightFile] = useState<File | null>(null);
  const [isAsymmetrical, setIsAsymmetrical] = useState(false);
  const [leftProcessedUrl, setLeftProcessedUrl] = useState<string | null>(null);
  const [rightProcessedUrl, setRightProcessedUrl] = useState<string | null>(null);

  // Jacket Specific State
  const [jacketSegments, setJacketSegments] = useState<Record<string, string>>({});
  const [backgroundRemovedUrl, setBackgroundRemovedUrl] = useState<string | null>(null);

  // Config State
  const [category, setCategory] = useState<ClothingCategory>(ClothingCategory.TOP);
  const [personaType, setPersonaType] = useState<PersonaType>(PersonaType.MALE);
  
  // Processing State
  const [processingStatus, setProcessingStatus] = useState('');
  const [processedImageUrl, setProcessedImageUrl] = useState<string | null>(null);
  const [originalPreviewUrl, setOriginalPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Skip Persona State (Task 31/32) - name/description for an item saved
  // without going through Fabric.js fitting, since that's normally where
  // this info is entered (in FittingEditor's own "Garment Identity" panel).
  // skipPersonaStatus distinguishes the two ways to reach this shared step:
  // NOT_FITTED (Task 31, from PREVIEW - has a clean cutout, just unfitted)
  // vs INELIGIBLE_NO_CUTOUT (Task 32, from CONFIG - no removal attempted,
  // so there's no cutout to ever fit).
  const [skipName, setSkipName] = useState('');
  const [skipDescription, setSkipDescription] = useState('');
  const [skipPersonaStatus, setSkipPersonaStatus] = useState<PersonaStatus>(PersonaStatus.NOT_FITTED);

  const { addItem } = useClothingStore();

  // Task 50: which category (if any) every item created this flow should
  // also be added to - a single choice on CONFIG (the one step every save
  // path passes through, per Task 31/32's own step-machine notes) rather
  // than repeating the picker per save path.
  const { collections, fetchCollections, createCollection } = useCollectionStore();
  const [selectedCollectionId, setSelectedCollectionId] = useState<number | null>(null);
  const [isCreatingCollection, setIsCreatingCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');

  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  const handleCreateCollectionInline = async () => {
    const name = newCollectionName.trim();
    if (!name) return;
    const created = await createCollection(name);
    setSelectedCollectionId(created.collectionId);
    setNewCollectionName('');
    setIsCreatingCollection(false);
  };

  // Every addItem call in this file funnels through here instead - a shoe
  // pair creates two items (handleShoeSave), both get added to the same
  // selected category, without duplicating this logic at each of
  // UploadFlow's five distinct save paths.
  const createItemAndMaybeAddToCollection = async (
    data: Parameters<typeof addItem>[0]
  ): Promise<ClothingItem> => {
    const newItem = await addItem(data);
    if (selectedCollectionId != null) {
      await useCollectionStore.getState().addItem(selectedCollectionId, newItem.itemId);
    }
    return newItem;
  };

  const resetFlow = () => {
    setStep('UPLOAD');
    setFile(null);
    setRightFile(null);
    setIsAsymmetrical(false);
    setLeftProcessedUrl(null);
    setRightProcessedUrl(null);
    setJacketSegments({});
    setBackgroundRemovedUrl(null);
    setCategory(ClothingCategory.TOP);
    setPersonaType(PersonaType.MALE);
    setProcessedImageUrl(null);
    setOriginalPreviewUrl(null);
    setError(null);
    setSkipName('');
    setSkipDescription('');
    setSkipPersonaStatus(PersonaStatus.NOT_FITTED);
    setSelectedCollectionId(null);
    setIsCreatingCollection(false);
    setNewCollectionName('');
  };

  const handleClose = () => {
    resetFlow();
    onClose();
  };

  const handleFileSelect = (selectedFile: File) => {
    setFile(selectedFile);
    setOriginalPreviewUrl(URL.createObjectURL(selectedFile));
    setStep('CONFIG');
  };

  const handleNextAfterConfig = () => {
    if (category === ClothingCategory.SHOES) {
      setStep('SHOE_SYMMETRY');
    } else {
      startProcessing();
    }
  };

  const startProcessing = async () => {
    if (!file) return;
    
    setStep('PROCESSING');
    setError(null);
    
    try {
      if (category === ClothingCategory.SHOES) {
         setProcessingStatus('Digitizing pair...');
         const leftResult = await bgRemovalService.removeBackground(file, {
           onProgress: (status) => setProcessingStatus(status)
         });
         setLeftProcessedUrl(leftResult.url);

         if (isAsymmetrical && rightFile) {
            setProcessingStatus('Processing right shoe...');
            const rightResult = await bgRemovalService.removeBackground(rightFile, {
              onProgress: (status) => setProcessingStatus(`Right Shoe: ${status}`)
            });
            setRightProcessedUrl(rightResult.url);
         } else {
            setRightProcessedUrl(leftResult.url);
         }
         setStep('SHOE_FITTING');
      } else {
         setProcessingStatus('Analyzing garment...');
         const result = await bgRemovalService.removeBackground(file, {
           onProgress: (status) => setProcessingStatus(status)
         });
         
         setBackgroundRemovedUrl(result.url);
         
         // If removal worked perfectly (or at least used an AI method), show preview
         if (result.method !== 'original') {
            setStep('PREVIEW');
         } else {
            // If all AI failed, go directly to cleanup
            setStep('GARMENT_CLEANUP');
         }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Processing failed. Please try again.';
      setError(message);
    }
  };

  const continueWithOriginal = async () => {
    if (!file) return;
    setError(null);
    setProcessingStatus('Optimizing for cleanup...');
    try {
      const optimizedFile = await optimizeImage(file);
      const localUrl = URL.createObjectURL(optimizedFile);
      
      if (category === ClothingCategory.SHOES) {
        setProcessingStatus('Uploading original image...');
        const url = await cloudinaryService.uploadImage(optimizedFile);
        setLeftProcessedUrl(url);
        setRightProcessedUrl(url);
        setStep('SHOE_FITTING');
      } else {
        setBackgroundRemovedUrl(localUrl);
        setStep('GARMENT_CLEANUP');
      }
    } catch (err) {
      setError('Upload failed.');
    }
  };

  const handleCleanupComplete = async (cleanedDataUrl: string) => {
    try {
      setStep('PROCESSING');
      setProcessingStatus('Finalizing cleaned asset...');
      
      // Upload cleaned image to Cloudinary
      const response = await fetch(cleanedDataUrl);
      const blob = await response.blob();
      const finalUrl = await cloudinaryService.uploadImage(blob);
      
      // We set this as the primary image URL for all garments, including jackets.
      // This ensures the closet view shows the clean source image.
      setProcessedImageUrl(finalUrl);
      
      if (category === ClothingCategory.JACKET) {
        // Now perform modular analysis on the final cleaned image
        setProcessingStatus('Analyzing modular structure...');
        const fileFinal = new File([blob], 'cleaned_jacket.png', { type: 'image/png' });
        
        const segments = await segmentationService.segmentJacket(fileFinal);
        
        if (segments.size > 0) {
          const segmentUrls: Record<string, string> = {};
          for (const [name, sBlob] of segments.entries()) {
            const sUrl = await cloudinaryService.uploadImage(sBlob);
            segmentUrls[name] = sUrl;
          }
          setJacketSegments(segmentUrls);
          setStep('JACKET_FITTING');
        } else {
          // Fallback if AI fails even after cleanup
          setProcessedImageUrl(finalUrl);
          setStep('FITTING');
        }
      } else {
        setProcessedImageUrl(finalUrl);
        setStep('FITTING');
      }
    } catch (err) {
      console.error('Final cleanup processing failed:', err);
      setError('Failed to process cleaned image.');
    }
  };

  const handleCleanupSkip = async () => {
    if (!backgroundRemovedUrl) return;
    try {
      setStep('PROCESSING');
      setProcessingStatus('Finalizing asset...');
      
      // Fetch the blob from the local ObjectURL or Cloudinary URL
      const response = await fetch(backgroundRemovedUrl);
      const blob = await response.blob();
      const finalUrl = await cloudinaryService.uploadImage(blob);

      if (category === ClothingCategory.JACKET) {
        setProcessingStatus('Analyzing garment structure...');
        const fileForAI = new File([blob], 'jacket.png', { type: 'image/png' });
        
        const segments = await segmentationService.segmentJacket(fileForAI);
        const segmentUrls: Record<string, string> = {};
        
        for (const [name, sBlob] of segments.entries()) {
          const sUrl = await cloudinaryService.uploadImage(sBlob);
          segmentUrls[name] = sUrl;
        }

        setJacketSegments(segmentUrls);
        setStep('JACKET_FITTING');
      } else {
        setProcessedImageUrl(finalUrl);
        setStep('FITTING');
      }
    } catch (err) {
      setError('Failed to process image.');
    }
  };

  // Saves the item without persona fitting, skipping FITTING/JACKET_FITTING
  // entirely. Shared by two entry points that set skipPersonaStatus before
  // navigating here:
  //  - NOT_FITTED (Task 31, from PREVIEW): has a clean AI cutout
  //    (backgroundRemovedUrl), just never fitted.
  //  - INELIGIBLE_NO_CUTOUT (Task 32, from CONFIG): no removal was
  //    attempted at all, so the raw original File is uploaded as-is.
  // Uses the same default transform FittingEditor would have seeded as a
  // starting point, so a later "promote to fitted" flow has sensible
  // coordinates to start from instead of none at all.
  const handleSkipSave = async () => {
    setError(null);
    try {
      setStep('PROCESSING');
      setProcessingStatus('Saving to closet...');

      let finalUrl: string;
      if (skipPersonaStatus === PersonaStatus.INELIGIBLE_NO_CUTOUT) {
        if (!file) return;
        const optimizedFile = await optimizeImage(file);
        finalUrl = await cloudinaryService.uploadImage(optimizedFile);
      } else {
        if (!backgroundRemovedUrl) return;
        const response = await fetch(backgroundRemovedUrl);
        const blob = await response.blob();
        finalUrl = await cloudinaryService.uploadImage(blob);
      }

      await createItemAndMaybeAddToCollection({
        name: skipName || 'Untitled Garment',
        description: skipDescription,
        category,
        personaType,
        imageUrl: finalUrl,
        personaStatus: skipPersonaStatus,
        transform: DEFAULT_TRANSFORMS[personaType][category]
      });
      handleClose();
    } catch (err: unknown) {
      setError('Failed to save garment.');
      setStep('SKIP_PERSONA');
    }
  };

  // Entry point for Task 32: skips background removal entirely, before it
  // ever runs, to avoid the wait for a user who already knows they want the
  // original image. Distinct from continueWithOriginal, which still routes
  // through GARMENT_CLEANUP -> FITTING (manual cutout, persona-eligible) -
  // this path attempts no cutout at all and is explicitly persona-ineligible.
  const handleSkipBackgroundRemoval = () => {
    setSkipPersonaStatus(PersonaStatus.INELIGIBLE_NO_CUTOUT);
    setStep('SKIP_PERSONA');
  };

  const startProcessingStandard = async () => {
    if (!file) return;
    setStep('PROCESSING');
    setProcessingStatus('Finalizing single-layer asset...');
    try {
      const url = await cloudinaryService.uploadImage(file);
      setProcessedImageUrl(url);
      setStep('FITTING');
    } catch (err: unknown) {
      setError('Failed to upload image.');
    }
  };

  const handleJacketSegmentationComplete = (segments: Record<string, string>) => {
    setJacketSegments(segments);
    if (Object.keys(segments).length > 0) {
      setStep('JACKET_FITTING');
    } else {
      startProcessingStandard();
    }
  };

  const handleSave = async (data: { name: string; description: string; transform: ClothingTransform }) => {
    if (!processedImageUrl) return;
    try {
      await createItemAndMaybeAddToCollection({
        name: data.name,
        description: data.description,
        category,
        personaType,
        imageUrl: processedImageUrl,
        transform: data.transform
      });
      handleClose();
    } catch (err: unknown) {
      setError('Failed to save garment.');
    }
  };

  const handleShoeSave = async (data: { 
    name: string; 
    description: string; 
    leftTransform: ClothingTransform; 
    rightTransform: ClothingTransform;
    skipLeft: boolean;
    skipRight: boolean;
  }) => {
    try {
      if (!data.skipLeft && leftProcessedUrl) {
        await createItemAndMaybeAddToCollection({
          name: `${data.name} (Left)`,
          description: data.description,
          category: ClothingCategory.SHOES,
          personaType,
          imageUrl: leftProcessedUrl,
          side: 'left',
          transform: data.leftTransform
        });
      }
      if (!data.skipRight && rightProcessedUrl) {
        await createItemAndMaybeAddToCollection({
          name: `${data.name} (Right)`,
          description: data.description,
          category: ClothingCategory.SHOES,
          personaType,
          imageUrl: rightProcessedUrl,
          side: 'right',
          transform: data.rightTransform
        });
      }
      handleClose();
    } catch (err: unknown) {
      setError('Failed to save shoe pair.');
    }
  };

  const handleModularJacketSave = async (data: { 
    name: string; 
    description: string; 
    modularData: string;
    previewUrl: string;
  }) => {
    try {
      setStep('PROCESSING');
      setProcessingStatus('Finalizing modular asset...');
      
      // For modular jackets, the user wants the closet thumbnail to be the 
      // RAW AI extraction (background removed), NOT the manual cleanup.
      let thumbnailImageUrl = processedImageUrl; // Default fallback

      if (backgroundRemovedUrl) {
         // Fetch the raw AI-extracted blob (before manual cleanup)
         const response = await fetch(backgroundRemovedUrl);
         const blob = await response.blob();
         thumbnailImageUrl = await cloudinaryService.uploadImage(blob);
      }

      if (!thumbnailImageUrl) throw new Error('Missing thumbnail image source.');

      await createItemAndMaybeAddToCollection({
        name: data.name,
        description: data.description,
        category: ClothingCategory.JACKET,
        personaType,
        imageUrl: thumbnailImageUrl, // This is the raw AI extraction for the closet
        isModular: true,
        modularData: data.modularData, // This contains the high-precision cleaned segments
        transform: { x: 375, y: 300, scaleX: 1, scaleY: 1, rotation: 0, width: 450, height: 450 }
      });
      handleClose();
    } catch (err: unknown) {
      setError('Failed to save modular jacket.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 overflow-hidden">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={handleClose}
        className="absolute inset-0 bg-background-main/90 backdrop-blur-2xl"
      />

      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className={`relative bg-background-secondary border border-white/5 rounded-[3rem] shadow-2xl overflow-hidden transition-all duration-700 ${
          step === 'FITTING' || step === 'SHOE_FITTING' || step === 'JACKET_FITTING' || step === 'GARMENT_CLEANUP' ? 'w-full max-w-6xl h-[90vh]' : 'w-full max-w-2xl'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          onClick={handleClose}
          className="absolute top-8 right-8 p-3 hover:bg-white/5 rounded-full transition-colors text-text-secondary hover:text-white z-50"
        >
          <X size={20} />
        </button>

        <div className="absolute top-0 left-0 right-0 h-1 bg-white/5 overflow-hidden">
          <motion.div 
            className="h-full bg-accent"
            initial={{ width: '0%' }}
            animate={{ 
              width: step === 'UPLOAD' ? '10%' : 
                     step === 'CONFIG' ? '20%' : 
                     step === 'GARMENT_CLEANUP' ? '40%' :
                     step === 'JACKET_SEGMENTATION' ? '60%' :
                     step === 'JACKET_FITTING' ? '80%' :
                     step === 'PROCESSING' ? '90%' : '100%' 
            }}
          />
        </div>

        <div className="p-8 md:p-12 h-full flex flex-col overflow-y-auto no-scrollbar">
          <AnimatePresence mode="wait">
            {step === 'UPLOAD' && (
              <motion.div key="upload" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
                <div className="text-center space-y-2">
                  <h2 className="text-3xl font-light tracking-tighter text-white uppercase italic">Step 1 — Initial Intake</h2>
                  <p className="text-text-secondary text-[10px] font-black tracking-widest uppercase opacity-40">Drop your garment to begin digitization</p>
                </div>
                <div onClick={() => document.getElementById('file-input')?.click()} className="aspect-video rounded-[2.5rem] border-2 border-dashed border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-accent/50 transition-all duration-500 cursor-pointer flex flex-col items-center justify-center group">
                  <input id="file-input" type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])} />
                  <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-accent/10 transition-all duration-500">
                    <Upload className="text-accent" size={32} />
                  </div>
                  <p className="text-white font-bold tracking-tight text-lg">Select Image</p>
                </div>
              </motion.div>
            )}

            {step === 'CONFIG' && (
              <motion.div key="config" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-12">
                <div className="text-center space-y-2">
                  <h2 className="text-3xl font-light tracking-tighter text-white uppercase italic">Step 2 — Architecture</h2>
                  <p className="text-text-secondary text-[10px] font-black tracking-widest uppercase opacity-40">Define garment category and persona target</p>
                </div>
                <div className="space-y-10">
                  <div className="space-y-6">
                    <div className="flex items-center gap-2 px-1">
                      <Layers size={14} className="text-accent" />
                      <label className="text-[10px] font-black tracking-[0.3em] text-accent uppercase">Garment Category</label>
                    </div>
                    <div className="flex flex-wrap justify-center gap-3">
                      {Object.values(ClothingCategory).map((cat) => {
                        const Icon = CATEGORY_ICONS[cat];
                        return (
                          <button key={cat} onClick={() => setCategory(cat)} className={`flex flex-col items-center gap-3 p-4 w-24 rounded-2xl border transition-all ${category === cat ? 'bg-accent/10 border-accent text-white' : 'bg-white/[0.02] border-white/5 text-text-secondary hover:border-white/20'}`}>
                            <Icon size={18} />
                            <span className="text-[8px] font-black uppercase tracking-widest">{cat}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="space-y-6">
                    <div className="flex items-center gap-2 px-1">
                      <User size={14} className="text-accent" />
                      <label className="text-[10px] font-black tracking-[0.3em] text-accent uppercase">Persona Target</label>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      {[PersonaType.MALE, PersonaType.FEMALE].map((type) => (
                        <button key={type} onClick={() => setPersonaType(type)} className={`flex items-center justify-center gap-4 py-6 rounded-[2rem] border transition-all ${personaType === type ? 'bg-accent/10 border-accent text-white' : 'bg-white/[0.02] border-white/5 text-text-secondary hover:border-white/20'}`}>
                          <span className="text-xs font-black uppercase tracking-[0.3em]">{type}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-6">
                    <div className="flex items-center gap-2 px-1">
                      <Layers size={14} className="text-accent" />
                      <label className="text-[10px] font-black tracking-[0.3em] text-accent uppercase">Category (Optional)</label>
                    </div>
                    <CategoryPicker
                      collections={collections}
                      selectedId={selectedCollectionId}
                      onSelect={setSelectedCollectionId}
                      isCreating={isCreatingCollection}
                      onStartCreating={() => setIsCreatingCollection(true)}
                      newName={newCollectionName}
                      onNewNameChange={setNewCollectionName}
                      onConfirmCreate={handleCreateCollectionInline}
                      onCancelCreate={() => { setIsCreatingCollection(false); setNewCollectionName(''); }}
                    />
                  </div>
                </div>
                <button onClick={handleNextAfterConfig} className="w-full py-6 bg-accent hover:bg-accent-hover text-white rounded-[2rem] font-black text-xs tracking-[0.4em] uppercase transition-all shadow-xl shadow-accent/20 active:scale-[0.98] flex items-center justify-center gap-3">
                  <Sparkles size={18} />
                  <span>Next Step</span>
                </button>
                {category !== ClothingCategory.SHOES && (
                  <button
                    onClick={handleSkipBackgroundRemoval}
                    className="w-full py-4 bg-white/[0.02] hover:bg-white/5 text-text-secondary hover:text-white rounded-2xl font-black text-[10px] tracking-widest uppercase transition-all border border-white/5"
                  >
                    Skip Background Removal — Keep Original, No Persona
                  </button>
                )}
              </motion.div>
            )}

            {step === 'GARMENT_CLEANUP' && backgroundRemovedUrl && (
              <GarmentCleanup 
                imageUrl={backgroundRemovedUrl}
                onComplete={handleCleanupComplete}
                onSkip={handleCleanupSkip}
                onBack={() => setStep('CONFIG')}
              />
            )}

            {step === 'JACKET_SEGMENTATION' && file && (
              <JacketSegmentationTool 
                originalFile={file}
                onBack={() => setStep('GARMENT_CLEANUP')}
                onComplete={handleJacketSegmentationComplete}
              />
            )}

            {step === 'SHOE_SYMMETRY' && (
              <ShoeSymmetryCheck onSelect={(diff) => {
                 setIsAsymmetrical(diff);
                 if (diff) setStep('SHOE_UPLOAD_RIGHT');
                 else startProcessing();
              }} />
            )}

            {step === 'SHOE_UPLOAD_RIGHT' && (
              <motion.div key="upload-right" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
                <div className="text-center space-y-2">
                  <h2 className="text-3xl font-light tracking-tighter text-white uppercase italic">Step 3 — Second Asset</h2>
                  <p className="text-text-secondary text-[10px] font-black tracking-widest uppercase opacity-40">Upload the RIGHT shoe image</p>
                </div>
                <div onClick={() => document.getElementById('right-file-input')?.click()} className="aspect-video rounded-[2.5rem] border-2 border-dashed border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-emerald-500/50 transition-all duration-500 cursor-pointer flex flex-col items-center justify-center group">
                  <input id="right-file-input" type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && (setRightFile(e.target.files[0]), startProcessing())} />
                  <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-emerald-500/10 transition-all duration-500">
                    <Upload className="text-emerald-500" size={32} />
                  </div>
                  <p className="text-white font-bold tracking-tight text-lg">Select Right Shoe</p>
                </div>
              </motion.div>
            )}

            {step === 'PROCESSING' && (
              <motion.div key="processing" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.1 }} className="flex flex-col items-center justify-center py-20 space-y-8">
                {!error ? (
                  <>
                    <div className="relative">
                      <div className="w-32 h-32 rounded-full border-2 border-white/5 flex items-center justify-center">
                        <Loader2 className="text-accent animate-spin" size={48} />
                      </div>
                      <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }} transition={{ repeat: Infinity, duration: 2 }} className="absolute inset-0 bg-accent/20 blur-3xl rounded-full" />
                    </div>
                    <div className="text-center space-y-6">
                      <p className="text-white font-bold tracking-tight text-xl">{processingStatus}</p>
                    </div>
                  </>
                ) : (
                  <div className="text-center space-y-6 max-w-sm">
                    <AlertCircle size={40} className="text-red-500 mx-auto" />
                    <div className="space-y-2">
                      <p className="text-white font-bold tracking-tight text-lg">Processing Failed</p>
                      <p className="text-text-secondary text-[10px] uppercase tracking-widest leading-relaxed">{error}</p>
                    </div>
                    
                    <div className="flex flex-col gap-3 pt-4">
                      <button 
                        onClick={startProcessing} 
                        className="w-full py-4 bg-accent hover:bg-accent-hover text-white rounded-2xl font-black text-[10px] tracking-widest uppercase transition-all shadow-lg shadow-accent/20"
                      >
                        Retry Removal
                      </button>
                      
                      <button 
                        onClick={continueWithOriginal} 
                        className="w-full py-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-black text-[10px] tracking-widest uppercase transition-all"
                      >
                        Continue with Original
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {step === 'PREVIEW' && backgroundRemovedUrl && (
              <motion.div key="preview" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-12">
                <div className="text-center space-y-2">
                  <h2 className="text-3xl font-light tracking-tighter text-white uppercase italic">Step 3 — Analysis Preview</h2>
                  <p className="text-text-secondary text-[10px] font-black tracking-widest uppercase opacity-40">Compare AI extraction with original source</p>
                </div>

                <div className="grid grid-cols-2 gap-8 h-[40vh]">
                  <div className="space-y-4">
                    <p className="text-[10px] font-black tracking-widest text-text-secondary uppercase text-center opacity-50">Original Source</p>
                    <div className="flex-1 h-full rounded-[2rem] border border-white/5 bg-white/[0.02] overflow-hidden flex items-center justify-center p-4">
                      <img src={originalPreviewUrl!} alt="Original" className="max-w-full max-h-full object-contain" />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <p className="text-[10px] font-black tracking-widest text-accent uppercase text-center">AI Extraction</p>
                    <div className="flex-1 h-full rounded-[2rem] border border-accent/20 bg-accent/5 overflow-hidden flex items-center justify-center p-4 relative">
                      <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '20px 20px' }} />
                      <img src={backgroundRemovedUrl} alt="Processed" className="max-w-full max-h-full object-contain relative z-10" />
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  <button
                    onClick={() => setStep('GARMENT_CLEANUP')}
                    className="w-full py-6 bg-accent hover:bg-accent-hover text-white rounded-[2rem] font-black text-xs tracking-[0.4em] uppercase transition-all shadow-xl shadow-accent/20 flex items-center justify-center gap-3"
                  >
                    <Sparkles size={18} />
                    <span>Confirm & Continue</span>
                  </button>

                  <button
                    onClick={() => { setSkipPersonaStatus(PersonaStatus.NOT_FITTED); setStep('SKIP_PERSONA'); }}
                    className="w-full py-4 bg-white/[0.02] hover:bg-white/5 text-text-secondary hover:text-white rounded-2xl font-black text-[10px] tracking-widest uppercase transition-all border border-white/5"
                  >
                    Skip Persona Fitting — Save for Flat Builder Only
                  </button>

                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={startProcessing}
                      className="py-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-black text-[10px] tracking-widest uppercase transition-all border border-white/5"
                    >
                      Retry Removal
                    </button>
                    <button
                      onClick={continueWithOriginal}
                      className="py-4 bg-white/5 hover:bg-white/10 text-text-secondary hover:text-white rounded-2xl font-black text-[10px] tracking-widest uppercase transition-all border border-white/5"
                    >
                      Skip AI Results
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 'SKIP_PERSONA' && (
              <motion.div key="skip-persona" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-10">
                <div className="text-center space-y-2">
                  <h2 className="text-3xl font-light tracking-tighter text-white uppercase italic">
                    {skipPersonaStatus === PersonaStatus.INELIGIBLE_NO_CUTOUT ? 'Save Original As-Is' : 'Save Without Fitting'}
                  </h2>
                  <p className="text-text-secondary text-[10px] font-black tracking-widest uppercase opacity-40">
                    {skipPersonaStatus === PersonaStatus.INELIGIBLE_NO_CUTOUT
                      ? "No background was removed, so this item can't be shown on the persona"
                      : "This item won't appear on the persona until fitted later"}
                  </p>
                </div>

                <div className="rounded-[2rem] border border-white/5 bg-white/[0.02] overflow-hidden flex items-center justify-center p-6 h-[30vh]">
                  <img
                    src={(skipPersonaStatus === PersonaStatus.INELIGIBLE_NO_CUTOUT ? originalPreviewUrl : backgroundRemovedUrl) ?? undefined}
                    alt="Preview"
                    className="max-w-full max-h-full object-contain"
                  />
                </div>

                <div className="space-y-4">
                  <input
                    type="text"
                    value={skipName}
                    onChange={(e) => setSkipName(e.target.value)}
                    placeholder="Garment name"
                    className="w-full px-5 py-4 bg-white/[0.02] border border-white/5 rounded-2xl text-white placeholder:text-text-secondary/50 text-sm focus:outline-none focus:border-accent/50"
                  />
                  <input
                    type="text"
                    value={skipDescription}
                    onChange={(e) => setSkipDescription(e.target.value)}
                    placeholder="Description (optional)"
                    className="w-full px-5 py-4 bg-white/[0.02] border border-white/5 rounded-2xl text-white placeholder:text-text-secondary/50 text-sm focus:outline-none focus:border-accent/50"
                  />
                </div>

                <div className="flex flex-col gap-4">
                  <button
                    onClick={handleSkipSave}
                    className="w-full py-6 bg-accent hover:bg-accent-hover text-white rounded-[2rem] font-black text-xs tracking-[0.4em] uppercase transition-all shadow-xl shadow-accent/20 flex items-center justify-center gap-3"
                  >
                    <Sparkles size={18} />
                    <span>Save to Closet</span>
                  </button>
                  <button
                    onClick={() => setStep(skipPersonaStatus === PersonaStatus.INELIGIBLE_NO_CUTOUT ? 'CONFIG' : 'PREVIEW')}
                    className="w-full py-4 bg-white/5 hover:bg-white/10 text-text-secondary hover:text-white rounded-2xl font-black text-[10px] tracking-widest uppercase transition-all border border-white/5"
                  >
                    Back
                  </button>
                </div>
              </motion.div>
            )}

            {step === 'FITTING' && (
              <motion.div key="fitting" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex-1 h-full">
                <FittingEditor imageUrl={processedImageUrl!} category={category} personaType={personaType} onSave={handleSave} onBack={() => setStep('CONFIG')} />
              </motion.div>
            )}

            {step === 'SHOE_FITTING' && (
              <motion.div key="shoe-fitting" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex-1 h-full">
                <ShoeFittingEditor leftImageUrl={leftProcessedUrl!} rightImageUrl={rightProcessedUrl!} personaType={personaType} onSave={handleShoeSave} onBack={() => setStep('SHOE_SYMMETRY')} />
              </motion.div>
            )}

            {step === 'JACKET_FITTING' && (
              <motion.div key="jacket-fitting" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex-1 h-full">
                <JacketFittingEditor 
                  segments={jacketSegments}
                  personaType={personaType}
                  onSave={handleModularJacketSave}
                  onBack={() => setStep('JACKET_SEGMENTATION')}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};

export default UploadFlow;
