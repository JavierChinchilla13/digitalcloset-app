import { Link } from 'react-router-dom';
import { Check, Sparkles } from 'lucide-react';
import { useFirstRun } from '../hooks/useFirstRun';

interface FirstRunPanelProps {
  // Saved outfits, where known (Showcase); makes "build an outfit" tick once there is one.
  outfitCount?: number;
  // A tighter layout for a side panel.
  compact?: boolean;
}

// Task 101: the guide a brand-new account sees on its empty screens: three steps (add pieces, build
// an outfit, see it in the Showcase). (Sample garments were tried and removed: they did not sit well
// on the figure.) Renders nothing once the account has what it needs or the guide was hidden.
const FirstRunPanel = ({ outfitCount, compact = false }: FirstRunPanelProps) => {
  const { show, dismiss, hasGarments, hasOutfit } = useFirstRun(outfitCount);

  if (!show) return null;

  const steps = [
    { done: hasGarments, label: 'Add a few pieces', hint: 'Upload photos of your own clothes.', to: '/closet', cta: 'Upload your own' },
    { done: hasOutfit, label: 'Build an outfit', hint: 'Pick a top, bottoms and shoes and see them on the figure.', to: '/outfits/flat/new', cta: 'Open the builder' },
    { done: hasOutfit, label: 'See it in your Showcase', hint: 'Saved outfits take center stage here.', to: '/showcase', cta: 'Open the Showcase' },
  ];

  return (
    <section
      data-testid="first-run-panel"
      aria-label="Getting started"
      className={`w-full text-left border border-accent/20 bg-accent/5 rounded-2xl ${compact ? 'p-4' : 'p-5 sm:p-8'}`}
    >
      <div className="flex items-start justify-between gap-4 mb-5">
        <div className="flex items-center gap-2 text-accent">
          <Sparkles size={16} />
          <h2 className="text-[11px] font-medium uppercase tracking-[0.3em]">Getting started</h2>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="text-[10px] uppercase tracking-widest text-text-secondary hover:text-text-primary transition-colors"
        >
          Hide this guide
        </button>
      </div>

      <ol className="space-y-3">
        {steps.map((step, index) => (
          <li key={step.label} className="flex items-start gap-3">
            <span
              aria-label={step.done ? 'Done' : `Step ${index + 1}`}
              className={`mt-0.5 w-5 h-5 shrink-0 rounded-full border flex items-center justify-center text-[10px] ${
                step.done ? 'bg-accent border-accent text-on-accent' : 'border-ink/20 text-text-secondary'
              }`}
            >
              {step.done ? <Check size={12} /> : index + 1}
            </span>
            <div className="min-w-0">
              <p className={`text-sm text-text-primary ${step.done ? 'line-through opacity-50' : ''}`}>{step.label}</p>
              {!compact && <p className="text-xs text-text-secondary">{step.hint}</p>}
            </div>
            {!step.done && (index === 0 || hasGarments) && (
              <Link to={step.to} className="ml-auto shrink-0 text-[10px] uppercase tracking-widest text-accent hover:underline">
                {step.cta}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
};

export default FirstRunPanel;
