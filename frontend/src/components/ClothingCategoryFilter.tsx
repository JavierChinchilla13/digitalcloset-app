import { useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { ClothingCategory } from '../types';

// Task 76 (Phase 9.7): replaces FlatOutfitBuilderPage's old `w-20` vertical
// category-icon sidebar with a single control under the search bar. Modeled
// on CategoryPicker.tsx's toggle-button + absolute-panel-below structure
// (same look/interaction), but a different data and selection model -
// CategoryPicker multi-selects arbitrary user-created Collections to link
// an outfit to, this single-selects one of the fixed ClothingCategory enum
// values (or "ALL") to filter the browse grid by, so it isn't a case of
// reusing that component as-is.
interface ClothingCategoryFilterProps {
  value: string; // 'ALL' | ClothingCategory
  onChange: (value: string) => void;
}

function formatCategoryLabel(value: string): string {
  if (value === 'ALL') return 'All';
  return value.charAt(0) + value.slice(1).toLowerCase();
}

const ClothingCategoryFilter = ({ value, onChange }: ClothingCategoryFilterProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const categories = Object.values(ClothingCategory);

  const select = (next: string) => {
    onChange(next);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl text-[10px] font-medium uppercase tracking-widest transition-all border border-ink/10 bg-ink/5 text-text-primary hover:border-ink/20"
      >
        <span>{formatCategoryLabel(value)}</span>
        <ChevronDown size={12} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          {/* Click-outside-to-close overlay, same pattern as CategoryPicker. */}
          <div className="fixed inset-0 z-30" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 right-0 top-full mt-2 bg-background-secondary border border-ink/10 rounded-2xl shadow-lg p-2 z-40 space-y-1 max-h-72 overflow-y-auto no-scrollbar">
            <button
              onClick={() => select('ALL')}
              className={`w-full flex items-center justify-between gap-2 text-left px-3 py-2 rounded-xl text-[9px] font-bold uppercase tracking-widest transition-colors ${
                value === 'ALL' ? 'bg-accent/10 text-accent' : 'text-text-secondary hover:bg-ink/5 hover:text-text-primary'
              }`}
            >
              <span>All</span>
              {value === 'ALL' && <Check size={12} className="flex-shrink-0" />}
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => select(cat)}
                className={`w-full flex items-center justify-between gap-2 text-left px-3 py-2 rounded-xl text-[9px] font-bold uppercase tracking-widest transition-colors ${
                  value === cat ? 'bg-accent/10 text-accent' : 'text-text-secondary hover:bg-ink/5 hover:text-text-primary'
                }`}
              >
                <span>{formatCategoryLabel(cat)}</span>
                {value === cat && <Check size={12} className="flex-shrink-0" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default ClothingCategoryFilter;
