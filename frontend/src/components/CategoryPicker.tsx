import { useState } from 'react';
import { Tag, Check, Plus, X } from 'lucide-react';
import type { Collection } from '../types';

// Shared by UploadFlow (Task 50) and FlatOutfitBuilderPage (Task 51) - both
// need the same "optionally link to a category at save time" control. No
// native <select> is used anywhere else in this codebase - every picker is
// a custom button/panel to match the app's own dark aesthetic, not the
// browser's default dropdown chrome.
//
// Multi-select (user feedback, 2026-09-03): an item/outfit can already
// belong to several categories (Task 33's multi-membership design) - the
// picker used to only let you choose one at creation time, which didn't
// match that. Selecting a row now toggles membership and the panel stays
// open, so several categories can be picked in one sitting.
interface CategoryPickerProps {
  collections: Collection[];
  selectedIds: number[];
  onToggle: (id: number) => void;
  isCreating: boolean;
  onStartCreating: () => void;
  newName: string;
  onNewNameChange: (name: string) => void;
  onConfirmCreate: () => void;
  onCancelCreate: () => void;
}

const CategoryPicker = ({
  collections, selectedIds, onToggle, isCreating, onStartCreating,
  newName, onNewNameChange, onConfirmCreate, onCancelCreate,
}: CategoryPickerProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const buttonLabel = selectedIds.length === 0
    ? 'No Category'
    : selectedIds.length === 1
      ? collections.find((c) => c.collectionId === selectedIds[0])?.name ?? 'No Category'
      : `${selectedIds.length} Categories`;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="flex items-center gap-2 px-4 py-3 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all border border-white/5 bg-white/[0.02] text-text-secondary hover:text-white hover:border-white/20"
      >
        <Tag size={12} />
        {buttonLabel}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-56 bg-background-secondary border border-white/10 rounded-2xl shadow-2xl p-2 z-40 space-y-1 max-h-64 overflow-y-auto no-scrollbar">
            {collections.length === 0 && !isCreating && (
              <p className="px-3 py-2 text-[8px] font-bold uppercase tracking-widest text-text-secondary opacity-50">
                No categories yet
              </p>
            )}
            {collections.map((c) => {
              const isSelected = selectedIds.includes(c.collectionId);
              return (
                <button
                  key={c.collectionId}
                  onClick={() => onToggle(c.collectionId)}
                  className={`w-full flex items-center justify-between gap-2 text-left px-3 py-2 rounded-xl text-[9px] font-bold uppercase tracking-widest transition-colors ${
                    isSelected ? 'bg-accent/10 text-accent' : 'text-text-secondary hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <span className="truncate">{c.name}</span>
                  {isSelected && <Check size={12} className="flex-shrink-0" />}
                </button>
              );
            })}
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
