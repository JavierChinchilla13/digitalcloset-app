import React from 'react';
import { motion } from 'framer-motion';
import { Layers, Copy, Sparkles, Footprints } from 'lucide-react';

interface ShoeSymmetryCheckProps {
  onSelect: (isDifferent: boolean) => void;
}

const ShoeSymmetryCheck: React.FC<ShoeSymmetryCheckProps> = ({ onSelect }) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-12 py-10"
    >
      <div className="text-center space-y-4">
        <div className="inline-flex p-4 bg-accent/10 rounded-3xl text-accent mb-4">
          <Footprints size={32} />
        </div>
        <h2 className="text-4xl font-light tracking-tighter text-text-primary uppercase italic">Pair Configuration</h2>
        <p className="text-text-secondary text-xs font-medium uppercase tracking-[0.2em] opacity-40 max-w-md mx-auto">
          Is the other shoe visually different? 
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Option 1: Mirrored */}
        <button
          onClick={() => onSelect(false)}
          className="group relative p-8 bg-ink/[0.02] border border-ink/5 rounded-[2.5rem] hover:bg-ink/[0.05] hover:border-accent/30 transition-all duration-500 text-left overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-10 opacity-[0.03] group-hover:opacity-[0.08] group-hover:scale-110 transition-all duration-700 pointer-events-none">
            <Copy size={120} />
          </div>
          
          <div className="relative z-10 space-y-6">
            <div className="w-14 h-14 bg-ink/5 rounded-2xl flex items-center justify-center text-text-secondary group-hover:text-text-primary group-hover:bg-accent/20 transition-all">
              <Copy size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-text-primary uppercase tracking-tighter">No, Mirror This</h3>
              <p className="text-[10px] text-text-secondary font-black uppercase tracking-widest mt-2 opacity-50">Standard identical pair</p>
            </div>
            <ul className="space-y-2">
              <li className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-text-secondary">
                <div className="w-1 h-1 bg-accent rounded-full" />
                Auto-Horizontal Flip
              </li>
              <li className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-text-secondary">
                <div className="w-1 h-1 bg-accent rounded-full" />
                Single Image Source
              </li>
            </ul>
          </div>
        </button>

        {/* Option 2: Different */}
        <button
          onClick={() => onSelect(true)}
          className="group relative p-8 bg-ink/[0.02] border border-ink/5 rounded-[2.5rem] hover:bg-ink/[0.05] hover:border-emerald-500/30 transition-all duration-500 text-left overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-10 opacity-[0.03] group-hover:opacity-[0.08] group-hover:scale-110 transition-all duration-700 pointer-events-none">
            <Layers size={120} />
          </div>

          <div className="relative z-10 space-y-6">
            <div className="w-14 h-14 bg-ink/5 rounded-2xl flex items-center justify-center text-text-secondary group-hover:text-emerald-400 group-hover:bg-emerald-500/20 transition-all">
              <Layers size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-text-primary uppercase tracking-tighter">Yes, Upload Second</h3>
              <p className="text-[10px] text-text-secondary font-black uppercase tracking-widest mt-2 opacity-50">Asymmetrical or custom design</p>
            </div>
            <ul className="space-y-2">
              <li className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-text-secondary">
                <div className="w-1 h-1 bg-emerald-400 rounded-full" />
                Unique Left/Right Assets
              </li>
              <li className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-text-secondary">
                <div className="w-1 h-1 bg-emerald-400 rounded-full" />
                Independent Color/Pattern
              </li>
            </ul>
          </div>
        </button>
      </div>

      <div className="bg-accent/5 border border-accent/10 rounded-3xl p-6 flex gap-4 items-start">
        <Sparkles size={16} className="text-accent shrink-0 mt-0.5" />
        <p className="text-[9px] text-text-secondary leading-relaxed uppercase tracking-widest font-bold opacity-60">
          Tip: You can still independently adjust position, scale, and rotation for each foot in the next step, even if you mirror the image.
        </p>
      </div>
    </motion.div>
  );
};

export default ShoeSymmetryCheck;
