import React, { useState } from 'react';
import {
  ChevronLeft,
  Type,
  AlignLeft,
  Sparkles,
  Info,
  Footprints,
  Undo2,
  Trash
} from 'lucide-react';
import { PersonaType, type ClothingTransform } from '../../types';
import ShoeCanvas from './ShoeCanvas';
import TransformPanel from '../editor/TransformPanel';
import { SHOE_PAIR_PRESETS } from './Presets';

interface ShoeFittingEditorProps {
  leftImageUrl: string;
  rightImageUrl: string;
  personaType: PersonaType;
  onSave: (data: { 
    name: string; 
    description: string; 
    leftTransform: ClothingTransform; 
    rightTransform: ClothingTransform;
    skipLeft: boolean;
    skipRight: boolean;
  }) => void;
  onBack: () => void;
}

// "Shoe Studio": positions a left and a right shoe picture on the persona's feet. Each
// foot has its own transform (starting from the per-persona SHOE_PAIR_PRESETS) and can
// be skipped, so a single shoe can be saved. `onSave` hands back both transforms; the
// upload flow turns them into two garments (side 'left' / 'right').
const ShoeFittingEditor: React.FC<ShoeFittingEditorProps> = ({ 
  leftImageUrl, 
  rightImageUrl,
  personaType, 
  onSave, 
  onBack 
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [activeSide, setActiveSide] = useState<'left' | 'right'>('left');
  
  const [leftTransform, setLeftTransform] = useState<ClothingTransform>(SHOE_PAIR_PRESETS[personaType].left);
  const [rightTransform, setRightTransform] = useState<ClothingTransform>(SHOE_PAIR_PRESETS[personaType].right);
  
  const [skipLeft, setSkipLeft] = useState(false);
  const [skipRight, setSkipRight] = useState(false);

  // Merges `updates` into the transform of the given foot only.
  const handleTransformChange = (side: 'left' | 'right', updates: Partial<ClothingTransform>) => {
    if (side === 'left') {
      setLeftTransform(prev => ({ ...prev, ...updates }));
    } else {
      setRightTransform(prev => ({ ...prev, ...updates }));
    }
  };

  // Puts the foot being edited back to its preset position (the other foot is untouched).
  const handleReset = () => {
    if (activeSide === 'left') setLeftTransform(SHOE_PAIR_PRESETS[personaType].left);
    else setRightTransform(SHOE_PAIR_PRESETS[personaType].right);
  };

  return (
    <div className="flex flex-col h-full bg-background-secondary rounded-2xl lg:rounded-[3rem] overflow-hidden border border-ink/5 shadow-2xl">
      {/* Top Header */}
      <header className="shrink-0 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-3 lg:px-10 lg:py-6 border-b border-ink/5 bg-ink/5 backdrop-blur-md z-10">
        <div className="flex items-center gap-3 lg:gap-6">
          <button 
            onClick={onBack}
            aria-label="Back"
            className="p-3 hover:bg-ink/5 rounded-2xl transition-all text-text-secondary hover:text-text-primary"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <h2 className="text-xl font-light tracking-tighter text-text-primary uppercase italic">Shoe Studio</h2>
            <p className="hidden sm:block text-[9px] text-text-secondary font-black tracking-widest uppercase opacity-40">Precision Alignment Engine</p>
          </div>
        </div>

        <div className="order-last basis-full lg:order-none lg:basis-auto flex items-center gap-4">
           <div className="grid grid-cols-2 w-full lg:w-auto lg:flex p-1 bg-ink/5 rounded-2xl border border-ink/5">
              <button 
                onClick={() => setActiveSide('left')}
                className={`px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeSide === 'left' ? 'bg-accent text-on-accent shadow-lg' : 'text-text-secondary hover:text-text-primary'}`}
              >
                Left Foot
              </button>
              <button 
                onClick={() => setActiveSide('right')}
                className={`px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeSide === 'right' ? 'bg-accent text-on-accent shadow-lg' : 'text-text-secondary hover:text-text-primary'}`}
              >
                Right Foot
              </button>
           </div>
        </div>

        <button 
          onClick={() => onSave({ name, description, leftTransform, rightTransform, skipLeft, skipRight })}
          disabled={!name || (skipLeft && skipRight)}
          className={`
            px-5 lg:px-8 py-3.5 lg:py-4 rounded-full text-[10px] font-black uppercase tracking-[0.2em] lg:tracking-[0.3em] flex items-center gap-3 transition-all
            ${!name || (skipLeft && skipRight)
              ? 'bg-ink/5 text-ink/20 cursor-not-allowed'
              : 'bg-ink text-background-main hover:scale-105 active:scale-95 shadow-2xl shadow-ink/10'
            }
          `}
        >
          <Sparkles size={16} />
          Complete Pair
        </button>
      </header>

      {/* Task 93: below `lg` the three columns stack - canvas, then the foot being
          calibrated, then the name / foot management - and the body scrolls. */}
      <div className="flex flex-1 min-h-0 flex-col lg:flex-row overflow-y-auto lg:overflow-hidden no-scrollbar">
        {/* Left Control Panel */}
        <aside className="order-3 lg:order-1 w-full lg:w-80 shrink-0 border-t lg:border-t-0 lg:border-r border-ink/5 bg-ink/5 lg:overflow-y-auto no-scrollbar p-5 lg:p-8 space-y-8 lg:space-y-10">
          <div className="space-y-8">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-text-secondary">
                <Type size={14} className="text-accent" />
                <span className="text-[10px] font-black uppercase tracking-widest">Identify Piece</span>
              </div>
              <input 
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Leather Oxford Shoes"
                className="w-full bg-ink/5 border border-ink/5 rounded-2xl px-6 py-4 text-text-primary text-[10px] font-black tracking-widest focus:outline-none focus:border-accent/50 focus:bg-ink/10 transition-all"
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2 text-text-secondary">
                <AlignLeft size={14} className="text-accent" />
                <span className="text-[10px] font-black uppercase tracking-widest">Details</span>
              </div>
              <textarea 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add style notes..."
                rows={3}
                className="w-full bg-ink/5 border border-ink/5 rounded-2xl px-6 py-4 text-text-primary text-[10px] font-black tracking-widest focus:outline-none focus:border-accent/50 focus:bg-ink/10 transition-all resize-none"
              />
            </div>
          </div>

          <div className="h-px bg-ink/5" />

          <div className="space-y-6">
            <div className="flex items-center gap-2 text-text-secondary">
              <Footprints size={14} className="text-accent" />
              <span className="text-[10px] font-black uppercase tracking-widest">Foot Management</span>
            </div>
            
            <div className="grid grid-cols-1 gap-3">
              <button 
                onClick={() => setSkipLeft(!skipLeft)}
                className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${skipLeft ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' : 'bg-ink/5 border-ink/5 text-text-secondary hover:border-ink/10'}`}
              >
                <span className="text-[8px] font-black uppercase">Left: {skipLeft ? 'Skipped' : 'Active'}</span>
                {skipLeft ? <Undo2 size={12} /> : <Trash size={12} />}
              </button>
              <button 
                onClick={() => setSkipRight(!skipRight)}
                className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${skipRight ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' : 'bg-ink/5 border-ink/5 text-text-secondary hover:border-ink/10'}`}
              >
                <span className="text-[8px] font-black uppercase">Right: {skipRight ? 'Skipped' : 'Active'}</span>
                {skipRight ? <Undo2 size={12} /> : <Trash size={12} />}
              </button>
            </div>
          </div>

          <div className="hidden lg:block p-6 bg-accent/5 border border-accent/10 rounded-3xl space-y-3">
             <div className="flex items-center gap-2 text-accent">
               <Info size={14} />
               <span className="text-[9px] font-black uppercase tracking-widest">Usage Note</span>
             </div>
             <p className="text-[8px] text-text-secondary leading-relaxed uppercase tracking-[0.15em] font-medium opacity-60">
               Changes to {activeSide} transform only affect the selected asset. You can toggle between shoes at any time.
             </p>
          </div>
        </aside>

        {/* Studio Area */}
        <main className="order-1 lg:order-2 shrink-0 lg:shrink h-[56dvh] min-h-[20rem] lg:h-auto lg:flex-1 p-2 lg:p-8 relative overflow-hidden bg-ink/5">
          <ShoeCanvas 
            leftImageUrl={leftImageUrl}
            rightImageUrl={rightImageUrl}
            personaType={personaType}
            leftTransform={leftTransform}
            rightTransform={rightTransform}
            onTransformChange={handleTransformChange}
            activeSide={activeSide}
            onSideSelect={setActiveSide}
          />
        </main>

        {/* Right Transform Panel */}
        <aside className="order-2 lg:order-3 w-full lg:w-80 shrink-0 border-t lg:border-t-0 lg:border-l border-ink/5 bg-ink/5 lg:overflow-y-auto no-scrollbar p-5 lg:p-8">
           <div className="mb-6 lg:mb-10 flex items-center justify-between">
              <h3 className="text-[10px] font-black text-text-primary uppercase tracking-[0.3em]">
                {activeSide === 'left' ? 'LEFT FOOT' : 'RIGHT FOOT'}
              </h3>
              {/* Task 71: was a blue/emerald badge keyed off which foot is
                  active - off-palette, and redundant next to the "LEFT
                  FOOT"/"RIGHT FOOT" heading right above it (same reasoning
                  as ClosetPage's persona dot, Task 70). */}
              <div className="px-3 py-1 rounded-full text-[10px] font-medium uppercase tracking-widest bg-accent/10 text-accent">
                Calibrating...
              </div>
           </div>
           
           <TransformPanel 
             transform={activeSide === 'left' ? leftTransform : rightTransform}
             onTransformChange={(updates) => handleTransformChange(activeSide, updates)}
             onReset={handleReset}
           />
        </aside>
      </div>
    </div>
  );
};

export default ShoeFittingEditor;
