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
import { exportCanvasToImage } from '../editor/CanvasUtils';

interface FittingEditorProps {
  imageUrl: string;
  category: ClothingCategory;
  personaType: PersonaType;
  initialName?: string;
  initialDescription?: string;
  initialTransform?: ClothingTransform;
  onSave: (data: { name: string; description: string; transform: ClothingTransform }) => void;
  onBack: () => void;
}

const FittingEditor: React.FC<FittingEditorProps> = ({ 
  imageUrl, 
  category, 
  personaType, 
  initialName = '',
  initialDescription = '',
  initialTransform,
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

  const handleTransformChange = (updates: Partial<ClothingTransform>) => {
    setTransform(prev => ({ ...prev, ...updates }));
  };

  const handleReset = () => {
    setTransform(DEFAULT_TRANSFORMS[personaType][category]);
  };

  const handleExport = () => {
    if (fabricCanvasRef.current) {
      const dataUrl = exportCanvasToImage(fabricCanvasRef.current);
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
                imageUrl={imageUrl}
                category={category}
                personaType={personaType}
                transform={transform}
                onTransformChange={setTransform}
                onCanvasReady={(canvas) => { fabricCanvasRef.current = canvas; }}
              />
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
              onClick={() => onSave({ name, description, transform })}
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
