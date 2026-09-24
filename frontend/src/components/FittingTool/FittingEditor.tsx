import React, { useState, useRef } from 'react';
import { 
  ChevronLeft, 
  Save, 
  Type, 
  AlignLeft, 
  Sparkles,
  Info
} from 'lucide-react';
import { Canvas } from 'fabric';
import { ClothingCategory, PersonaType, type ClothingTransform } from '../../types';
import { DEFAULT_TRANSFORMS } from './Presets';

// New Fabric Editor Components
import ClothingCanvas from '../editor/ClothingCanvas';
import TransformPanel from '../editor/TransformPanel';
import CanvasToolbar from '../editor/CanvasToolbar';
import WarpPanel, { type WarpApplyResult } from '../editor/WarpPanel';
import { exportCanvasToImage, CANVAS_PAD } from '../editor/CanvasUtils';
import { cloudinaryService } from '../../api/cloudinaryService';
import { retargetTransform } from '../../utils/meshWarp';
import { serializeWarpData, type WarpData } from '../../utils/warpData';

interface FittingEditorProps {
  imageUrl: string;
  category: ClothingCategory;
  personaType: PersonaType;
  initialName?: string;
  initialDescription?: string;
  initialTransform?: ClothingTransform;
  // Task 56 prototype: offer the mesh-warp tool (tops only, non-modular).
  // `initialWarp` is the item's saved warp record, if it already has one.
  allowWarp?: boolean;
  initialWarp?: WarpData | null;
  // `imageUrl`/`modularData` are only present when the warp changed this
  // session: the baked image replaces the item's image, and modularData
  // ('' to clear) holds what's needed to re-edit or undo the warp.
  onSave: (data: {
    name: string;
    description: string;
    transform: ClothingTransform;
    imageUrl?: string;
    modularData?: string;
  }) => void;
  onBack: () => void;
}

const FittingEditor: React.FC<FittingEditorProps> = ({
  imageUrl,
  category,
  personaType,
  initialName = '',
  initialDescription = '',
  initialTransform,
  allowWarp = false,
  initialWarp = null,
  onSave,
  onBack
}) => {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [transform, setTransform] = useState<ClothingTransform>(
    initialTransform || DEFAULT_TRANSFORMS[personaType][category]
  );

  const [activeTool, setActiveTool] = useState('select');
  const fabricCanvasRef = useRef<Canvas | null>(null);

  // Task 56 prototype (mesh warp). `currentImageUrl` is what the canvas shows
  // (the baked PNG once a warp is applied); `warp` keeps the original image +
  // control points so the warp can be re-edited or undone.
  const [currentImageUrl, setCurrentImageUrl] = useState(imageUrl);
  const [warp, setWarp] = useState<WarpData | null>(initialWarp);
  const [warpChanged, setWarpChanged] = useState(false);

  const handleWarpApply = async (result: WarpApplyResult) => {
    const uploadedUrl = await cloudinaryService.uploadImage(result.bake.blob);

    const previousPx = warp
      ? { width: warp.bakedWidth, height: warp.bakedHeight }
      : { width: result.sourceWidth, height: result.sourceHeight };
    const previousShift = warp?.shift ?? { x: 0, y: 0 };

    setTransform((prev) =>
      retargetTransform(prev, previousPx, result.bake, {
        x: result.bake.shift.x - previousShift.x,
        y: result.bake.shift.y - previousShift.y,
      })
    );
    setWarp({
      version: 1,
      originalImageUrl: warp?.originalImageUrl ?? currentImageUrl,
      originalWidth: result.sourceWidth,
      originalHeight: result.sourceHeight,
      grid: result.grid,
      bakedWidth: result.bake.width,
      bakedHeight: result.bake.height,
      shift: result.bake.shift,
    });
    setCurrentImageUrl(uploadedUrl);
    setWarpChanged(true);
    setActiveTool('select');
  };

  const handleRestoreWarp = () => {
    if (!warp) return;
    setTransform((prev) =>
      retargetTransform(
        prev,
        { width: warp.bakedWidth, height: warp.bakedHeight },
        { width: warp.originalWidth, height: warp.originalHeight },
        { x: -warp.shift.x, y: -warp.shift.y }
      )
    );
    setCurrentImageUrl(warp.originalImageUrl);
    setWarp(null);
    setWarpChanged(true);
    if (activeTool === 'warp') setActiveTool('select');
  };

  const handleTransformChange = (updates: Partial<ClothingTransform>) => {
    setTransform(prev => ({ ...prev, ...updates }));
  };

  const handleReset = () => {
    setTransform(DEFAULT_TRANSFORMS[personaType][category]);
  };

  const handleResetCrop = () => {
    const canvas = fabricCanvasRef.current;
    if (canvas) {
      const garment = canvas.getObjects().find(obj => obj.name === 'garment');
      if (garment) garment.set({ clipPath: undefined });
      const cropBox = canvas.getObjects().find(obj => obj.name === 'cropBox');
      if (cropBox) canvas.remove(cropBox);
      canvas.requestRenderAll();
    }
    setTransform(prev => ({
      ...prev,
      maskLeft: undefined,
      maskTop: undefined,
      maskWidth: undefined,
      maskHeight: undefined,
    }));
    if (activeTool === 'crop') setActiveTool('select');
  };

  const handleExport = () => {
    if (fabricCanvasRef.current) {
      // Export just the stage, not the handle margin ClothingCanvas pads
      // around it. The region is in canvas (viewport) pixels, so it starts
      // at the margin.
      const canvas = fabricCanvasRef.current;
      const dataUrl = exportCanvasToImage(canvas, {
        left: CANVAS_PAD,
        top: CANVAS_PAD,
        width: canvas.getWidth() - 2 * CANVAS_PAD,
        height: canvas.getHeight() - 2 * CANVAS_PAD,
      });
      const link = document.createElement('a');
      link.download = `fitting-preview-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    }
  };

  return (
    <div className="flex flex-col h-full bg-background-main/50">
      {/* Top Navigation / Toolbar */}
      <div className="flex flex-col md:flex-row gap-6 items-center justify-between mb-8">
        <div className="flex items-center gap-6">
          <button 
            onClick={onBack}
            className="p-3 hover:bg-ink/5 rounded-2xl text-text-secondary hover:text-text-primary transition-all border border-ink/5"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="space-y-1">
            <h2 className="text-xl font-light tracking-tighter text-text-primary uppercase italic flex items-center gap-2">
              <Sparkles size={16} className="text-accent" />
              Fabric Studio
            </h2>
            <p className="text-[10px] font-medium text-text-secondary tracking-[0.4em] uppercase opacity-40">Precision Garment Digitization</p>
          </div>
        </div>

        <div className="w-full md:w-auto">
          <CanvasToolbar
            activeTool={activeTool}
            onToolChange={setActiveTool}
            onExport={handleExport}
            hasMask={!!transform.maskWidth}
            onResetCrop={handleResetCrop}
            canWarp={allowWarp}
            hasWarp={!!warp}
            onRestoreWarp={handleRestoreWarp}
          />
        </div>
      </div>

      <div className="flex-grow flex flex-col md:flex-row gap-8 overflow-hidden">
        {/* Left Sidebar: Advanced Controls */}
        <aside className="w-full md:w-80 flex flex-col gap-8 order-2 md:order-1 overflow-y-auto no-scrollbar pb-10">
          <div className="bg-background-secondary/20 border border-ink/5 rounded-2xl p-8 space-y-10">
            <div className="flex items-center gap-3 border-b border-ink/5 pb-6">
              <div className="w-2 h-2 bg-accent rounded-full" />
              <h3 className="text-[10px] font-medium tracking-[0.3em] text-text-primary uppercase">Geometric Calibration</h3>
            </div>
            
            <TransformPanel 
              transform={transform} 
              onTransformChange={handleTransformChange}
              onReset={handleReset}
            />
          </div>

          {/* Quick Info HUD */}
          <div className="mt-auto bg-accent/5 border border-accent/10 rounded-3xl p-6 flex gap-4">
            <Info size={16} className="text-accent shrink-0" />
            <p className="text-[10px] text-text-secondary leading-relaxed uppercase tracking-widest font-bold opacity-60">
              Fabric.js integration enabled. Your transforms are calculated in a virtual 1000px coordinate space for cross-device consistency.
            </p>
          </div>
        </aside>

        {/* Main Canvas Area */}
        <main className="flex-1 flex flex-col gap-6 order-1 md:order-2">
          <div className="flex-grow relative min-h-[500px]">
             <ClothingCanvas
                imageUrl={currentImageUrl}
                category={category}
                personaType={personaType}
                transform={transform}
                onTransformChange={setTransform}
                onCanvasReady={(canvas) => { fabricCanvasRef.current = canvas; }}
                activeTool={activeTool}
              />
             {allowWarp && activeTool === 'warp' && (
               <WarpPanel
                 sourceUrl={warp?.originalImageUrl ?? currentImageUrl}
                 warp={warp}
                 personaType={personaType}
                 transform={transform}
                 hasCrop={!!transform.maskWidth}
                 onApply={handleWarpApply}
                 onCancel={() => setActiveTool('select')}
               />
             )}
          </div>
        </main>

        {/* Right Sidebar: Identity */}
        <aside className="w-full md:w-80 flex flex-col gap-8 order-3 overflow-y-auto no-scrollbar pb-10">
          <div className="bg-background-secondary/20 border border-ink/5 rounded-2xl p-8 space-y-8">
            <div className="flex items-center gap-3 border-b border-ink/5 pb-6">
              <div className="w-2 h-2 bg-emerald-400 rounded-full" />
              <h3 className="text-[10px] font-medium tracking-[0.3em] text-text-primary uppercase">Garment Identity</h3>
            </div>

            <div className="space-y-8">
              {/* Name Input */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 px-1">
                  <Type size={14} className="text-accent" />
                  <label className="text-[10px] font-medium tracking-[0.3em] text-accent uppercase">Identity Name</label>
                </div>
                <input 
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Vintage Oversized Tee"
                  className="w-full bg-ink/[0.03] border border-ink/5 rounded-2xl py-5 px-6 text-sm text-text-primary focus:outline-none focus:border-accent/50 focus:bg-ink/[0.05] transition-all uppercase tracking-widest"
                />
              </div>

              {/* Description */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 px-1">
                  <AlignLeft size={14} className="text-accent" />
                  <label className="text-[10px] font-medium tracking-[0.3em] text-accent uppercase">Description</label>
                </div>
                <textarea 
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Details about material, fit, etc."
                  className="w-full bg-ink/[0.03] border border-ink/5 rounded-2xl py-5 px-6 text-xs text-ink/70 focus:outline-none focus:border-accent/50 focus:bg-ink/[0.05] transition-all resize-none leading-relaxed"
                />
              </div>
            </div>

            <button 
              onClick={() => onSave({
                name,
                description,
                transform,
                ...(warpChanged && {
                  imageUrl: currentImageUrl,
                  modularData: warp ? serializeWarpData(warp) : '',
                }),
              })}
              disabled={!name}
              className={`
                w-full py-6 rounded-2xl font-medium text-[10px] tracking-[0.4em] uppercase transition-all flex items-center justify-center gap-3 shadow-lg
                ${!name
                  ? 'bg-ink/5 text-text-secondary cursor-not-allowed opacity-20' 
                  : 'bg-ink text-background-main hover:scale-[1.02] active:scale-[0.98]'
                }
              `}
            >
              <Save size={18} />
              <span>Archive Style</span>
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default FittingEditor;
