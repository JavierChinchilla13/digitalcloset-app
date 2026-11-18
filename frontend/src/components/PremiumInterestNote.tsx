import { useEffect, useState } from 'react';
import { Check, Loader2, Sparkles } from 'lucide-react';
import { premiumInterestService } from '../api/premiumInterestService';
import { usePremiumInterestEligible } from '../hooks/usePremiumInterestEligible';
import { useAuthStore } from '../store/useAuthStore';
import { getApiErrorMessage } from '../utils/apiError';

type Phase = 'checking' | 'idle' | 'sending' | 'requested';

interface PremiumInterestNoteProps {
  className?: string;
}

// While payments are off: "Premium is coming soon. Want it? Let us know." and a "Request Premium" button, so demand can be measured. It
// promises no price, date or feature. Shown only to a declared adult with confirmed details (see usePremiumInterestEligible); the button
// is idle, sending, then "Requested" (disabled) with a short thank-you. The result is announced in a live region. Asking twice is harmless
// (the server answers "requested" again), and a failure says so in words and leaves the button usable.
const PremiumInterestNote = ({ className = '' }: PremiumInterestNoteProps) => {
  const eligible = usePremiumInterestEligible();
  const userId = useAuthStore((state) => state.user?.userId);
  const [phase, setPhase] = useState<Phase>('checking');
  const [error, setError] = useState<string | null>(null);

  // Has this account asked already? (Keeps "Requested" after a reload or on another device.)
  useEffect(() => {
    if (!eligible) return;
    let cancelled = false;
    premiumInterestService
      .getState()
      .then((state) => {
        if (!cancelled) setPhase(state.requested ? 'requested' : 'idle');
      })
      .catch(() => {
        if (!cancelled) setPhase('idle');
      });
    return () => {
      cancelled = true;
    };
  }, [eligible, userId]);

  if (!eligible) return null;

  const send = async () => {
    setPhase('sending');
    setError(null);
    try {
      const state = await premiumInterestService.request();
      setPhase(state.requested ? 'requested' : 'idle');
    } catch (err) {
      setError(getApiErrorMessage(err, "Couldn't send your request. Please try again."));
      setPhase('idle');
    }
  };

  const requested = phase === 'requested';
  const sending = phase === 'sending';

  return (
    <div
      className={`rounded-xl border border-ink/10 bg-ink/[0.03] p-4 space-y-3 normal-case tracking-normal ${className}`}
      data-testid="premium-interest"
    >
      <p className="text-sm text-text-primary leading-snug">Premium is coming soon. Want it? Let us know.</p>
      <button
        type="button"
        onClick={send}
        disabled={requested || sending || phase === 'checking'}
        aria-describedby="premium-interest-result"
        className="w-full min-h-[44px] py-3 bg-accent text-on-accent text-[10px] font-medium uppercase tracking-widest rounded-xl inline-flex items-center justify-center gap-2 transition-[transform,opacity] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 disabled:opacity-60 disabled:active:scale-100"
      >
        {sending ? (
          <>
            <Loader2 size={14} className="animate-spin" aria-hidden /> Sending...
          </>
        ) : requested ? (
          <>
            <Check size={14} aria-hidden /> Requested
          </>
        ) : (
          <>
            <Sparkles size={14} aria-hidden /> Request Premium
          </>
        )}
      </button>
      {/* One live region for the result: the thank-you, or what went wrong. */}
      <div id="premium-interest-result" role="status" aria-live="polite" className="text-xs leading-snug">
        {requested && <p className="text-text-secondary">Thanks, we&apos;ll let you know.</p>}
        {error && (
          <p role="alert" className="text-rose-400">
            {error}
          </p>
        )}
      </div>
    </div>
  );
};

export default PremiumInterestNote;
