import { useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { PersonaType } from '../types';

// Task 76 follow-up (Phase 9.7): a small control to switch which persona
// type ("Male"/"Female") the outfit builder's Persona Preview targets,
// placed directly in FlatOutfitBuilderPage since /persona (the standalone
// picker) is otherwise the only place to change it. A dropdown LIST
// rather than a cycle-on-click toggle (ThemeToggle.tsx's pattern) -
// deliberately, per explicit feedback: only two persona types exist
// today, but the list renders from `Object.values(PersonaType)`, so a
// future third type is just another enum member, no UI change needed.
// Modeled on ClothingCategoryFilter's toggle-button + panel-below
// structure (itself modeled on CategoryPicker) - same interaction, a
// third reuse of the pattern, still not the component itself since this
// is single-select over a different fixed enum with no "reset" option.
//
// Second follow-up: this control doubles as the browse grid's gender
// filter now ("only garments of that gender should appear"), which needs
// a way to see everything again - added "Any" as a third list entry.
// "Any" is NOT a `PersonaType` (the backend/global persona store only
// ever knows Male or Female - adding a fake third enum value there would
// break every other page's strict Male/Female comparisons), so the value
// type here is `PersonaType | 'ANY'`, purely a local UI/filter concept.
// The future real third persona type the component was already built to
// accommodate is a separate thing from this - when it exists, it's just
// another `PersonaType` list row, same as Male/Female are today.
export type PersonaFilterValue = PersonaType | 'ANY';

interface PersonaTypeSwitcherProps {
  value: PersonaFilterValue;
  onChange: (value: PersonaFilterValue) => void;
}

function formatPersonaLabel(value: PersonaFilterValue): string {
  if (value === 'ANY') return 'Any';
  return value.charAt(0) + value.slice(1).toLowerCase();
}

const PersonaTypeSwitcher = ({ value, onChange }: PersonaTypeSwitcherProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const options: PersonaFilterValue[] = ['ANY', ...Object.values(PersonaType)];

  const select = (next: PersonaFilterValue) => {
    onChange(next);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-medium uppercase tracking-widest transition-all border border-ink/5 bg-ink/[0.02] text-text-secondary hover:text-text-primary hover:border-ink/20"
        title="Persona type"
      >
        <span>{formatPersonaLabel(value)}</span>
        <ChevronDown size={10} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 top-full mt-2 min-w-[120px] bg-background-secondary border border-ink/10 rounded-2xl shadow-lg p-2 z-40 space-y-1">
            {options.map((opt) => (
              <button
                key={opt}
                onClick={() => select(opt)}
                className={`w-full flex items-center justify-between gap-2 text-left px-3 py-2 rounded-xl text-[9px] font-bold uppercase tracking-widest transition-colors ${
                  value === opt ? 'bg-accent/10 text-accent' : 'text-text-secondary hover:bg-ink/5 hover:text-text-primary'
                }`}
              >
                <span>{formatPersonaLabel(opt)}</span>
                {value === opt && <Check size={12} className="flex-shrink-0" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default PersonaTypeSwitcher;
