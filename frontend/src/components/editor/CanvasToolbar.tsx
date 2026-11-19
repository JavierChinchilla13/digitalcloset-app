import React from 'react';
import {
  MousePointer2,
  Crop,
  Download,
  Undo2,
  RotateCcw,
  Grid3x3
} from 'lucide-react';
import { useT } from '../../i18n';

interface CanvasToolbarProps {
  activeTool: string;
  onToolChange: (tool: string) => void;
  onExport: () => void;
  hasMask?: boolean;
  onResetCrop?: () => void;
  // Task 56 prototype: mesh warp, offered only for garment types that support it.
  canWarp?: boolean;
  hasWarp?: boolean;
  onRestoreWarp?: () => void;
}

// The tool picker above a garment canvas: Select, Crop & Mask and (for garment types
// that support it) Warp, plus export, undo-crop and restore-warp actions. It only
// reports what was chosen; the editor decides what each tool does.
const CanvasToolbar: React.FC<CanvasToolbarProps> = ({
  activeTool,
  onToolChange,
  onExport,
  hasMask = false,
  onResetCrop,
  canWarp = false,
  hasWarp = false,
  onRestoreWarp
}) => {
  const { t } = useT();
  const tools = [
    { id: 'select', icon: MousePointer2, label: t('toolbar.select') },
    { id: 'crop', icon: Crop, label: t('toolbar.crop') },
    ...(canWarp ? [{ id: 'warp', icon: Grid3x3, label: t('toolbar.warp') }] : []),
  ];

  return (
    <div className="flex flex-wrap items-center justify-between gap-y-2 bg-background-secondary/40 backdrop-blur-xl border border-ink/5 p-2 rounded-2xl">
      <div className="flex flex-wrap items-center gap-1">
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
                  ? 'bg-accent text-on-accent shadow-lg' 
                  : 'text-text-secondary hover:bg-ink/5 hover:text-text-primary'
                }
              `}
              title={tool.label}
              aria-label={tool.label}
            >
              <Icon size={16} />
              <span className="text-[9px] font-black uppercase tracking-widest hidden md:block">
                {tool.label}
              </span>
            </button>
          );
        })}
        {hasMask && onResetCrop && (
          <button
            onClick={onResetCrop}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all text-text-secondary hover:bg-ink/5 hover:text-text-primary"
            title={t('toolbar.resetCrop')}
            aria-label={t('toolbar.resetCrop')}
          >
            <Undo2 size={16} />
            <span className="text-[9px] font-black uppercase tracking-widest hidden md:block">
              {t('toolbar.resetCrop')}
            </span>
          </button>
        )}
        {hasWarp && onRestoreWarp && (
          <button
            onClick={onRestoreWarp}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all text-text-secondary hover:bg-ink/5 hover:text-text-primary"
            title={t('toolbar.restore')}
            aria-label={t('toolbar.restore')}
          >
            <RotateCcw size={16} />
            <span className="text-[9px] font-black uppercase tracking-widest hidden md:block">
              {t('toolbar.restoreShort')}
            </span>
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 sm:pr-2">
        <div className="h-6 w-[1px] bg-ink/5 mx-1 sm:mx-2" />
        <button 
          onClick={onExport}
          aria-label={t('toolbar.capture')}
          title={t('toolbar.capture')}
          className="flex items-center gap-2 px-4 py-2.5 bg-ink/5 hover:bg-ink/10 text-text-primary rounded-xl transition-all border border-ink/5"
        >
          <Download size={14} className="text-accent" />
          <span className="hidden sm:inline text-[9px] font-black uppercase tracking-widest">{t('toolbar.capture')}</span>
        </button>
      </div>
    </div>
  );
};

export default CanvasToolbar;
