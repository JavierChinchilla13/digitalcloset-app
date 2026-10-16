import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Loader2, Sparkles } from 'lucide-react';
import { useClothingStore } from '../store/useClothingStore';
import { usePersonaStore } from '../store/usePersonaStore';
import { useStorage } from '../hooks/useStorage';
import { useFirstRun } from '../hooks/useFirstRun';
import { limitMessage } from '../utils/storage';
import { getApiErrorMessage } from '../utils/apiError';
import { SAMPLE_GARMENTS, STARTER_OUTFIT_SLUGS, sampleSlots, sampleToNewItems } from '../utils/sampleGarments';

interface FirstRunPanelProps {
  // Saved outfits, where known (Showcase); makes "build an outfit" tick once there is one.
  outfitCount?: number;
  // A tighter layout for a side panel.
  compact?: boolean;
}

// Task 101: the guide a brand-new account sees on its empty screens: three steps (add pieces, build
// an outfit, see it in the Showcase) and a picker of sample garments that can be added with a tap.
// Samples are real garments (they count toward the plan's limit and can be deleted in the closet).
// Renders nothing once the account has what it needs or the guide was hidden.
const FirstRunPanel = ({ outfitCount, compact = false }: FirstRunPanelProps) => {
  const { show, dismiss, hasGarments, hasOutfit } = useFirstRun(outfitCount);
  const items = useClothingStore((state) => state.items);
  const personaType = usePersonaStore((state) => state.persona.type);
  const storage = useStorage();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!show) return null;

  // Samples already in the closet are matched by their picture, so each can be added once.
  const owned = new Set(items.map((item) => item.imageUrl));

  // Adds the given samples one after another; stops with a clear message at the plan's limit.
  const addSamples = async (slugs: string[], busyKey: string) => {
    setError(null);
    const todo = SAMPLE_GARMENTS.filter((s) => slugs.includes(s.slug) && !owned.has(s.imageUrl));
    if (todo.length === 0) return;
    const slotsNeeded = todo.reduce((sum, s) => sum + sampleSlots(s), 0);
    if (!storage.canAdd(slotsNeeded)) {
      // No room at all: the standard sentence. Some room: say how many fit, so one sample can still be added.
      const room = storage.remaining ?? 0;
      setError(room === 0 ? limitMessage(storage) : `Your closet has room for ${room} more garment${room === 1 ? '' : 's'}. Add them one by one, or delete a garment first.`);
      return;
    }
    setBusy(busyKey);
    try {
      for (const sample of todo) {
        for (const piece of sampleToNewItems(sample, personaType)) {
          await useClothingStore.getState().addItem(piece);
        }
      }
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not add the sample. Please try again.'));
    } finally {
      setBusy(null);
    }
  };

  const steps = [
    { done: hasGarments, label: 'Add a few pieces', hint: 'Upload your own photos, or start with the samples below.', to: '/closet', cta: 'Upload your own' },
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

      <ol className="space-y-3 mb-6">
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

      {!hasOutfit && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <p className="text-[10px] uppercase tracking-widest text-text-secondary">Try sample pieces</p>
            <button
              type="button"
              onClick={() => addSamples(STARTER_OUTFIT_SLUGS, 'starter')}
              disabled={busy !== null}
              className="px-4 py-2 rounded-full bg-ink text-background-main text-[10px] uppercase tracking-widest font-medium disabled:opacity-40"
            >
              {busy === 'starter' ? 'Adding...' : 'Add a starter outfit'}
            </button>
          </div>
          <ul className={`grid gap-2 ${compact ? 'grid-cols-3' : 'grid-cols-3 sm:grid-cols-4 md:grid-cols-7'}`}>
            {SAMPLE_GARMENTS.map((sample) => {
              const isOwned = owned.has(sample.imageUrl);
              const isBusy = busy === sample.slug;
              return (
                <li key={sample.slug}>
                  <button
                    type="button"
                    aria-label={isOwned ? `${sample.name} (added)` : `Add ${sample.name}`}
                    disabled={isOwned || busy !== null}
                    onClick={() => addSamples([sample.slug], sample.slug)}
                    className="relative w-full aspect-[3/4] rounded-xl overflow-hidden border border-ink/10 bg-ink/5 disabled:opacity-50 hover:border-accent/40 transition-colors"
                  >
                    <img src={sample.imageUrl} alt="" loading="lazy" decoding="async" className="w-full h-full object-contain p-1" />
                    <span className="absolute inset-x-0 bottom-0 bg-black/60 text-white text-[9px] uppercase tracking-wider py-1 truncate px-1">
                      {isOwned ? 'Added' : sample.name}
                    </span>
                    {isBusy && (
                      <span className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <Loader2 size={18} className="animate-spin text-white" />
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-[10px] text-text-secondary leading-relaxed">
            Samples count toward your garment limit and can be deleted from your closet any time.
          </p>
        </>
      )}

      {error && (
        <p role="alert" className="mt-3 text-xs text-rose-400">
          {error}
        </p>
      )}
    </section>
  );
};

export default FirstRunPanel;
