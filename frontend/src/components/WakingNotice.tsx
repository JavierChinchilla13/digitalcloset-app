import { Loader2 } from 'lucide-react';
import { useWakingStore } from '../api/wakingNotice';
import { useT } from '../i18n';

// Audit H11: the calm, non-blocking line shown under the navbar while the sleeping API wakes up (see api/wakingNotice.ts for when).
// The live region is always in the page, so a screen reader announces the text when it appears; the box itself only exists while
// the message is due, and it never takes a click (pointer-events-none), so nothing underneath is blocked.
const WakingNotice = () => {
  const { t } = useT();
  const visible = useWakingStore((state) => state.visible);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="waking-notice"
      className="pointer-events-none fixed inset-x-4 top-[calc(5.5rem+env(safe-area-inset-top))] md:top-24 z-[120] flex justify-center"
    >
      {visible && (
        <p className="inline-flex max-w-md items-center gap-3 rounded-2xl border border-ink/10 bg-background-secondary px-4 py-3 text-xs leading-relaxed text-text-primary shadow-lg">
          <Loader2 size={16} className="shrink-0 animate-spin text-accent" aria-hidden />
          <span>{t('waking.message')}</span>
        </p>
      )}
    </div>
  );
};

export default WakingNotice;
