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

  const handleTransformChange = (side: 'left' | 'right', updates: Partial<ClothingTransform>) => {
    if (side === 'left') {
      setLeftTransform(prev => ({ ...prev, ...updates }));
    } else {
      setRightTransform(prev => ({ ...prev, ...updates }));
    }
  };

  const handleReset = () => {
    if (activeSide === 'left') setLeftTransform(SHOE_PAIR_PRESETS[personaType].left);
    else setRightTransform(SHOE_PAIR_PRESETS[personaType].right);
  };

  return (
    <div className="flex flex-col h-full bg-background-secondary rounded-[3rem] overflow-hidden border border-white/5 shadow-2xl">
      {/* Top Header */}
      <header className="flex items-center justify-between px-10 py-6 border-b border-white/5 bg-black/20 backdrop-blur-md z-10">
        <div className="flex items-center gap-6">
          <button 
            onClick={onBack}
            className="p-3 hover:bg-white/5 rounded-2xl transition-all text-text-secondary hover:text-white"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <h2 className="text-xl font-light tracking-tighter text-white uppercase italic">Shoe Studio</h2>
            <p className="text-[9px] text-text-secondary font-black tracking-widest uppercase opacity-40">Precision Alignment Engine</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
           <div className="flex p-1 bg-white/5 rounded-2xl border border-white/5">
              <button 
                onClick={() => setActiveSide('left')}
                className={`px-6 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeSide === 'left' ? 'bg-accent text-white shadow-lg' : 'text-text-secondary hover:text-white'}`}
              >
                Left Foot
              </button>
              <button 
                onClick={() => setActiveSide('right')}
                className={`px-6 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeSide === 'right' ? 'bg-accent text-white shadow-lg' : 'text-text-secondary hover:text-white'}`}
              >
                Right Foot
              </button>
           </div>
        </div>

        <button 
          onClick={() => onSave({ name, description, leftTransform, rightTransform, skipLeft, skipRight })}
          disabled={!name || (skipLeft && skipRight)}
          className={`
            px-8 py-4 rounded-full text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-3 transition-all
            ${!name || (skipLeft && skipRight)
              ? 'bg-white/5 text-white/20 cursor-not-allowed'
              : 'bg-white text-background-main hover:scale-105 active:scale-95 shadow-2xl shadow-white/10'
            }
          `}
        >
          <Sparkles size={16} />
          Complete Pair
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Control Panel */}
        <aside className="w-80 border-r border-white/5 bg-black/10 overflow-y-auto no-scrollbar p-8 space-y-10">
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
                className="w-full bg-white/5 border border-white/5 rounded-2xl px-6 py-4 text-white text-[10px] font-black tracking-widest focus:outline-none focus:border-accent/50 focus:bg-white/10 transition-all"
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
                className="w-full bg-white/5 border border-white/5 rounded-2xl px-6 py-4 text-white text-[10px] font-black tracking-widest focus:outline-none focus:border-accent/50 focus:bg-white/10 transition-all resize-none"
              />
            </div>
          </div>

          <div className="h-px bg-white/5" />

          <div className="space-y-6">
            <div className="flex items-center gap-2 text-text-secondary">
              <Footprints size={14} className="text-accent" />
              <span className="text-[10px] font-black uppercase tracking-widest">Foot Management</span>
            </div>
            
            <div className="grid grid-cols-1 gap-3">
              <button 
                onClick={() => setSkipLeft(!skipLeft)}
                className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${skipLeft ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' : 'bg-white/5 border-white/5 text-text-secondary hover:border-white/10'}`}
              >
                <span className="text-[8px] font-black uppercase">Left: {skipLeft ? 'Skipped' : 'Active'}</span>
                {skipLeft ? <Undo2 size={12} /> : <Trash size={12} />}
              </button>
              <button 
                onClick={() => setSkipRight(!skipRight)}
                className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${skipRight ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' : 'bg-white/5 border-white/5 text-text-secondary hover:border-white/10'}`}
              >
                <span className="text-[8px] font-black uppercase">Right: {skipRight ? 'Skipped' : 'Active'}</span>
                {skipRight ? <Undo2 size={12} /> : <Trash size={12} />}
              </button>
            </div>
          </div>

          <div className="p-6 bg-accent/5 border border-accent/10 rounded-3xl space-y-3">
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
        <main className="flex-1 p-8 relative overflow-hidden bg-black/20">
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
        <aside className="w-80 border-l border-white/5 bg-black/10 overflow-y-auto no-scrollbar p-8">
           <div className="mb-10 flex items-center justify-between">
              <h3 className="text-[10px] font-black text-white uppercase tracking-[0.3em]">
                {activeSide === 'left' ? 'LEFT FOOT' : 'RIGHT FOOT'}
              </h3>
              <div className={`px-3 py-1 rounded-full text-[7px] font-black uppercase tracking-widest ${activeSide === 'left' ? 'bg-blue-500/10 text-blue-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
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
