import React from 'react';
import {
  MousePointer2,
  Crop,
  Download
} from 'lucide-react';

interface CanvasToolbarProps {
  activeTool: string;
  onToolChange: (tool: string) => void;
  onExport: () => void;
}

const CanvasToolbar: React.FC<CanvasToolbarProps> = ({ 
  activeTool, 
  onToolChange,
  onExport
}) => {
  const tools = [
    { id: 'select', icon: MousePointer2, label: 'Select' },
    { id: 'crop', icon: Crop, label: 'Crop & Mask' },
  ];

  return (
    <div className="flex items-center justify-between bg-background-secondary/40 backdrop-blur-xl border border-white/5 p-2 rounded-2xl">
      <div className="flex items-center gap-1">
        {tools.map((tool) => {
          const Icon = tool.icon;
          const isActive = activeTool === tool.id;
          return (
            <button
              key={tool.id}
              onClick={() => onToolChange(tool.id)}
              className={`
                flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all
                ${isActive 
                  ? 'bg-accent text-white shadow-lg shadow-accent/20' 
                  : 'text-text-secondary hover:bg-white/5 hover:text-white'
                }
              `}
              title={tool.label}
            >
              <Icon size={16} />
              <span className="text-[9px] font-black uppercase tracking-widest hidden md:block">
                {tool.label}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2 pr-2">
        <div className="h-6 w-[1px] bg-white/5 mx-2" />
        <button 
          onClick={onExport}
          className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-all border border-white/5"
        >
          <Download size={14} className="text-accent" />
          <span className="text-[9px] font-black uppercase tracking-widest">Capture Preview</span>
        </button>
      </div>
    </div>
  );
};

export default CanvasToolbar;
