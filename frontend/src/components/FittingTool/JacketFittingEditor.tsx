import React, { useState, useRef } from 'react';
import {
  ChevronLeft,
  Save,
  Type,
  AlignLeft,
  Layers,
  Info,
  Scissors
} from 'lucide-react';
import { Canvas } from 'fabric';
import { PersonaType, type ClothingTransform, type ModularJacketData } from '../../types';
import JacketCanvas from '../editor/JacketCanvas';
import TransformPanel from '../editor/TransformPanel';
import { exportCanvasToImage } from '../editor/CanvasUtils';

interface JacketFittingEditorProps {
  segments: Record<string, string>;
  personaType: PersonaType;
  onSave: (data: { name: string; description: string; modularData: string; previewUrl: string }) => void;
  onBack: () => void;
}

const JacketFittingEditor: React.FC<JacketFittingEditorProps> = ({ 
  segments, 
  personaType, 
  onSave, 
  onBack 
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [activePart, setActivePart] = useState<string>('torso');
  const [isGroupMode, setIsGroupMode] = useState(true);
  
  const [modularData, setModularData] = useState<ModularJacketData>(() => {
    const initialSegments: Record<string, any> = {};
    Object.entries(segments).forEach(([name, url]) => {
      initialSegments[name] = {
        imageUrl: url,
        transform: { x: 375, y: 300, scaleX: 1, scaleY: 1, rotation: 0, width: 450, height: 450 }
      };
    });

    return {
      segments: initialSegments,
      isOpen: false,
      openness: 0,
      renderOrder: Object.keys(segments)
    };
  });

  const fabricCanvasRef = useRef<Canvas | null>(null);

  const handleDataChange = (newData: ModularJacketData) => {
    setModularData(newData);
  };

  const handleTransformChange = (updates: Partial<ClothingTransform>) => {
    if (isGroupMode) {
      // Apply same transform offset/updates to all segments
      setModularData(prev => {
        const nextSegments = { ...prev.segments };
        Object.keys(nextSegments).forEach(key => {
          const segKey = key as keyof ModularJacketData['segments'];
          const segment = nextSegments[segKey];
          if (segment) {
            nextSegments[segKey] = {
              ...segment,
              transform: { ...segment.transform, ...updates }
            };
          }
        });
        return { ...prev, segments: nextSegments };
      });
    } else {
      setModularData(prev => {
        const currentSegment = prev.segments[activePart as keyof ModularJacketData['segments']];
        if (!currentSegment) return prev;
        
        return {
          ...prev,
          segments: {
            ...prev.segments,
            [activePart]: {
              ...currentSegment,
              transform: { ...currentSegment.transform, ...updates }
            }
          }
        };
      });
    }
  };

  const handleOpennessChange = (val: number) => {
    setModularData(prev => ({ ...prev, isOpen: val > 0, openness: val }));
  };

  const handleReset = () => {
    handleTransformChange({ x: 375, y: 300, scaleX: 1, scaleY: 1, rotation: 0, width: 450, height: 450 });
  };

  const handleFinish = async () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    // 1. Temporarily hide the mannequin and indicators for a clean export
    const mannequin = canvas.getObjects().find(obj => obj.name === 'mannequin');
    const indicators = canvas.getObjects().filter(obj => obj.name === 'indicator');
    
    if (mannequin) mannequin.set({ visible: false });
    indicators.forEach(ind => ind.set({ visible: false }));
    
    // 2. Clear stroke highlights from active parts
    const objects = canvas.getObjects();
    const originalStrokes = objects.map(obj => ({ obj, stroke: obj.stroke, strokeWidth: obj.strokeWidth }));
    objects.forEach(obj => {
      if (obj.name && obj.name !== 'mannequin') {
        obj.set({ stroke: undefined, strokeWidth: 0 });
      }
    });

    canvas.renderAll();

    // 3. Export clean transparent image
    const previewUrl = exportCanvasToImage(canvas);

    // 4. Restore visibility and highlights
    if (mannequin) mannequin.set({ visible: true });
    indicators.forEach(ind => ind.set({ visible: true }));
    originalStrokes.forEach(({ obj, stroke, strokeWidth }) => {
      obj.set({ stroke, strokeWidth });
    });
    
    canvas.renderAll();

    onSave({
      name,
      description,
      modularData: JSON.stringify(modularData),
      previewUrl
    });
  };

  const currentTransform = modularData.segments[activePart as keyof ModularJacketData['segments']]?.transform;

  return (
    <div className="flex flex-col h-full bg-background-main/50">
      <div className="flex flex-col md:flex-row gap-6 items-center justify-between mb-8">
        <div className="flex items-center gap-6">
          <button 
            onClick={onBack}
            className="p-3 hover:bg-white/5 rounded-2xl text-text-secondary hover:text-white transition-all border border-white/5"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="space-y-1">
            <h2 className="text-xl font-light tracking-tighter text-white uppercase italic flex items-center gap-2">
              <Layers size={16} className="text-accent" />
              Modular Jacket Studio
            </h2>
            <p className="text-[8px] font-black text-text-secondary tracking-[0.4em] uppercase opacity-40">Precision Segment Orchestration</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
           <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-1 flex gap-1">
              {Object.keys(segments).map(name => (
                <button
                  key={name}
                  onClick={() => {
                    setActivePart(name);
                    setIsGroupMode(false);
                  }}
                  className={`px-4 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all ${
                    activePart === name && !isGroupMode 
                      ? 'bg-accent text-white shadow-[0_0_15px_rgba(91,140,255,0.3)]' 
                      : 'text-text-secondary hover:text-white'
                  }`}
                >
                  {name.replace(/([A-Z])/g, ' $1')}
                </button>
              ))}
              <button
                onClick={() => {
                  setIsGroupMode(true);
                }}
                className={`px-4 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all ${
                  isGroupMode 
                    ? 'bg-accent text-white shadow-[0_0_15px_rgba(91,140,255,0.3)]' 
                    : 'text-text-secondary hover:text-white'
                }`}
              >
                All
              </button>
           </div>
        </div>
      </div>

      <div className="flex-grow flex flex-col md:flex-row gap-8 overflow-hidden">
        <aside className="w-full md:w-80 flex flex-col gap-8 order-2 md:order-1 overflow-y-auto no-scrollbar pb-10">
          <div className="bg-background-secondary/20 border border-white/5 rounded-[2.5rem] p-8 space-y-10">
            <div className="flex items-center gap-3 border-b border-white/5 pb-6">
              <div className={`w-2 h-2 rounded-full shadow-[0_0_10px_currentColor] ${isGroupMode ? 'text-emerald-400 bg-emerald-400' : 'text-accent bg-accent'}`} />
              <h3 className="text-[10px] font-black tracking-[0.3em] text-white uppercase">
                {isGroupMode ? 'Global Calibration' : `${activePart.replace(/([A-Z])/g, ' $1')} Calibration`}
              </h3>
            </div>
            
            {currentTransform && (
              <TransformPanel 
                transform={currentTransform} 
                onTransformChange={handleTransformChange}
                onReset={handleReset}
              />
            )}

            <div className="pt-6 border-t border-white/5 space-y-6">
               <div className="flex items-center gap-2">
                 <Scissors size={12} className="text-accent" />
                 <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white">Center Opening</span>
               </div>
               <div className="space-y-4">
                 <div className="flex justify-between text-[10px] font-mono text-white/50">
                    <span>Closed</span>
                    <span>{Math.round((modularData.openness || 0) * 100)}%</span>
                 </div>
                 <input 
                   type="range" 
                   min="0" max="0.6" step="0.01"
                   value={modularData.openness || 0}
                   onChange={(e) => handleOpennessChange(parseFloat(e.target.value))}
                   className="w-full h-1 bg-white/5 rounded-full appearance-none cursor-pointer accent-accent"
                 />
               </div>
            </div>
          </div>

          <div className="mt-auto bg-accent/5 border border-accent/10 rounded-3xl p-6 flex gap-4">
            <Info size={16} className="text-accent shrink-0" />
            <p className="text-[9px] text-text-secondary leading-relaxed uppercase tracking-widest font-bold opacity-60">
              Use Group Mode to position the entire jacket. Use Center Opening to show inner clothing.
            </p>
          </div>
        </aside>

        <main className="flex-1 flex flex-col gap-6 order-1 md:order-2">
          <div className="flex-grow relative min-h-[500px]">
             <JacketCanvas 
                segments={segments}
                personaType={personaType}
                modularData={modularData}
                onDataChange={handleDataChange}
                onCanvasReady={(canvas) => { fabricCanvasRef.current = canvas; }}
                activePart={activePart}
                isGroupMode={isGroupMode}
                onSelectPart={(part) => {
                  if (part) {
                    setActivePart(part);
                    setIsGroupMode(false);
                  } else {
                    setActivePart('');
                    setIsGroupMode(false);
                  }
                }}
              />
          </div>
        </main>

        <aside className="w-full md:w-80 flex flex-col gap-8 order-3 overflow-y-auto no-scrollbar pb-10">
          <div className="bg-background-secondary/20 border border-white/5 rounded-[2.5rem] p-8 space-y-8">
            <div className="flex items-center gap-3 border-b border-white/5 pb-6">
              <div className="w-2 h-2 bg-emerald-400 rounded-full shadow-[0_0_10px_#34D399]" />
              <h3 className="text-[10px] font-black tracking-[0.3em] text-white uppercase">Modular Identity</h3>
            </div>

            <div className="space-y-8">
              <div className="space-y-4">
                <div className="flex items-center gap-2 px-1">
                  <Type size={14} className="text-accent" />
                  <label className="text-[9px] font-black tracking-[0.3em] text-accent uppercase">Identity Name</label>
                </div>
                <input 
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Leather Biker Jacket"
                  className="w-full bg-white/[0.03] border border-white/5 rounded-2xl py-5 px-6 text-sm text-white focus:outline-none focus:border-accent/50 focus:bg-white/[0.05] transition-all uppercase tracking-widest"
                />
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2 px-1">
                  <AlignLeft size={14} className="text-accent" />
                  <label className="text-[9px] font-black tracking-[0.3em] text-accent uppercase">Description</label>
                </div>
                <textarea 
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Details about material, modular fit, etc."
                  className="w-full bg-white/[0.03] border border-white/5 rounded-2xl py-5 px-6 text-xs text-white/70 focus:outline-none focus:border-accent/50 focus:bg-white/[0.05] transition-all resize-none leading-relaxed"
                />
              </div>
            </div>

            <button 
              onClick={handleFinish}
              disabled={!name}
              className={`
                w-full py-6 rounded-2xl font-black text-[10px] tracking-[0.4em] uppercase transition-all flex items-center justify-center gap-3 shadow-2xl
                ${!name
                  ? 'bg-white/5 text-text-secondary cursor-not-allowed opacity-20' 
                  : 'bg-white text-background-main hover:scale-[1.02] active:scale-[0.98]'
                }
              `}
            >
              <Save size={18} />
              <span>Initialize Modular Asset</span>
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default JacketFittingEditor;
