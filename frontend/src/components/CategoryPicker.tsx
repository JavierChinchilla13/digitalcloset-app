import { useState } from 'react';
import { Tag, Check, Plus, X } from 'lucide-react';
import type { Collection } from '../types';

// Shared by UploadFlow (Task 50) and FlatOutfitBuilderPage (Task 51) - both
// need the same "optionally link to a category at save time" control. No
// native <select> is used anywhere else in this codebase - every picker is
// a custom button/panel to match the app's own dark aesthetic, not the
// browser's default dropdown chrome.
interface CategoryPickerProps {
  collections: Collection[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  isCreating: boolean;
  onStartCreating: () => void;
  newName: string;
  onNewNameChange: (name: string) => void;
  onConfirmCreate: () => void;
  onCancelCreate: () => void;
}

const CategoryPicker = ({
  collections, selectedId, onSelect, isCreating, onStartCreating,
  newName, onNewNameChange, onConfirmCreate, onCancelCreate,
}: CategoryPickerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const selected = collections.find((c) => c.collectionId === selectedId);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="flex items-center gap-2 px-4 py-3 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all border border-white/5 bg-white/[0.02] text-text-secondary hover:text-white hover:border-white/20"
      >
        <Tag size={12} />
        {selected ? selected.name : 'No Category'}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-56 bg-background-secondary border border-white/10 rounded-2xl shadow-2xl p-2 z-40 space-y-1 max-h-64 overflow-y-auto no-scrollbar">
            <button
              onClick={() => { onSelect(null); setIsOpen(false); }}
              className="w-full text-left px-3 py-2 rounded-xl text-[9px] font-bold uppercase tracking-widest text-text-secondary hover:bg-white/5 hover:text-white transition-colors"
            >
              No Category
            </button>
            {collections.map((c) => (
              <button
                key={c.collectionId}
                onClick={() => { onSelect(c.collectionId); setIsOpen(false); }}
                className={`w-full text-left px-3 py-2 rounded-xl text-[9px] font-bold uppercase tracking-widest transition-colors ${
                  c.collectionId === selectedId ? 'bg-accent/10 text-accent' : 'text-text-secondary hover:bg-white/5 hover:text-white'
                }`}
              >
                {c.name}
              </button>
            ))}
            <div className="pt-1 border-t border-white/5">
              {isCreating ? (
                <div className="flex items-center gap-1 p-1">
                  <input
                    autoFocus
                    value={newName}
                    onChange={(e) => onNewNameChange(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && onConfirmCreate()}
                    placeholder="CATEGORY NAME"
                    className="flex-grow min-w-0 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-[9px] font-black tracking-widest uppercase focus:outline-none focus:border-accent/50"
                  />
                  <button onClick={onConfirmCreate} className="p-1.5 rounded-lg bg-accent/10 hover:bg-accent/20 text-accent transition-colors">
                    <Check size={12} />
                  </button>
                  <button onClick={onCancelCreate} className="p-1.5 rounded-lg hover:bg-white/5 text-text-secondary transition-colors">
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={onStartCreating}
                  className="w-full flex items-center gap-2 text-left px-3 py-2 rounded-xl text-[9px] font-bold uppercase tracking-widest text-accent hover:bg-accent/10 transition-colors"
                >
                  <Plus size={12} /> New Category
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default CategoryPicker;
