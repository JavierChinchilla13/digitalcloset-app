import React, { useState } from 'react';
import {
  RotateCw,
  Layers,
  FlipHorizontal,
  FlipVertical,
  Undo2,
  Lock,
  Unlock,
  ArrowUpDown,
  ArrowLeftRight
} from 'lucide-react';
import type { ClothingTransform } from '../../types';

interface TransformPanelProps {
  transform: ClothingTransform;
  onTransformChange: (updates: Partial<ClothingTransform>) => void;
  onReset: () => void;
}

const TransformPanel: React.FC<TransformPanelProps> = ({ 
  transform, 
  onTransformChange, 
  onReset 
}) => {
  const [isLocked, setIsLocked] = useState(true);

  const Slider = ({ 
    label, 
    value, 
    min, 
    max, 
    step = 1, 
    onChange, 
    icon: Icon 
  }: { 
    label: string; 
    value: number; 
    min: number; 
    max: number; 
    step?: number; 
    onChange: (val: number) => void;
    icon: any;
  }) => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2 text-text-secondary">
          <Icon size={12} className="text-accent" />
          <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
        </div>
        <span className="text-[10px] font-mono text-white/50">{value.toFixed(1)}</span>
      </div>
      <input 
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1 bg-white/5 rounded-full appearance-none cursor-pointer accent-accent"
      />
    </div>
  );

  return (
    <div className="flex flex-col gap-10">
      {/* Transformation Sliders */}
      <div className="space-y-8">
        <div className="flex items-center justify-between px-1">
          <p className="text-[9px] font-black text-text-secondary uppercase tracking-[0.3em]">Proportions</p>
          <button 
            onClick={() => setIsLocked(!isLocked)}
            className={`p-2 rounded-lg transition-all ${isLocked ? 'bg-accent/20 text-accent' : 'bg-white/5 text-text-secondary hover:text-white'}`}
            title={isLocked ? "Unlock Aspect Ratio" : "Lock Aspect Ratio"}
          >
            {isLocked ? <Lock size={12} /> : <Unlock size={12} />}
          </button>
        </div>

        <div className="space-y-8">
          <Slider 
            label="Width" 
            icon={ArrowLeftRight}
            value={transform.width || 450} 
            min={50} 
            max={1000} 
            step={1} 
            onChange={(val) => {
              if (isLocked) {
                const ratio = (transform.height || 450) / (transform.width || 450);
                onTransformChange({ width: val, height: val * ratio });
              } else {
                onTransformChange({ width: val });
              }
            }} 
          />
          
          <Slider 
            label="Height" 
            icon={ArrowUpDown}
            value={transform.height || 450} 
            min={50} 
            max={1000} 
            step={1} 
            onChange={(val) => {
              if (isLocked) {
                const ratio = (transform.width || 450) / (transform.height || 450);
                onTransformChange({ height: val, width: val * ratio });
              } else {
                onTransformChange({ height: val });
              }
            }} 
          />
        </div>
        
        <div className="h-px bg-white/5" />

        <Slider 
          label="Rotation" 
          icon={RotateCw}
          value={transform.rotation} 
          min={0} 
          max={360} 
          onChange={(val) => onTransformChange({ rotation: val })} 
        />

        <Slider 
          label="Opacity" 
          icon={Layers}
          value={transform.opacity ?? 1} 
          min={0} 
          max={1} 
          step={0.01} 
          onChange={(val) => onTransformChange({ opacity: val })} 
        />
      </div>

      {/* Quick Actions */}
      <div className="space-y-6">
        <p className="text-[9px] font-black text-text-secondary uppercase tracking-[0.3em] px-1">Quick Tools</p>
        <div className="grid grid-cols-2 gap-3">
          <button 
            onClick={() => onTransformChange({ flipX: !transform.flipX })}
            className={`flex items-center justify-center gap-2 p-4 rounded-2xl border transition-all ${transform.flipX ? 'bg-accent/10 border-accent text-white' : 'bg-white/5 border-white/5 text-text-secondary hover:border-white/10'}`}
          >
            <FlipHorizontal size={14} />
            <span className="text-[8px] font-black uppercase">Flip X</span>
          </button>
          <button 
            onClick={() => onTransformChange({ flipY: !transform.flipY })}
            className={`flex items-center justify-center gap-2 p-4 rounded-2xl border transition-all ${transform.flipY ? 'bg-accent/10 border-accent text-white' : 'bg-white/5 border-white/5 text-text-secondary hover:border-white/10'}`}
          >
            <FlipVertical size={14} />
            <span className="text-[8px] font-black uppercase">Flip Y</span>
          </button>
        </div>

        <button 
          onClick={onReset}
          className="w-full flex items-center justify-center gap-2 py-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl border border-white/5 transition-all"
        >
          <Undo2 size={14} className="text-accent" />
          <span className="text-[9px] font-black uppercase tracking-widest">Reset Transform</span>
        </button>
      </div>
    </div>
  );
};

export default TransformPanel;
