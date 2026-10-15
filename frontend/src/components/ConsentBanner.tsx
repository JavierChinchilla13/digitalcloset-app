import { Link } from 'react-router-dom';
import { useConsentStore } from '../store/useConsentStore';

// Task 99: the cookie / privacy choice. A slim bar at the bottom that does not cover the page (it
// is not a modal), with two equally prominent buttons so declining is as easy as accepting. It
// shows while no choice has been made, and again when the footer's "Cookie settings" is used.
// The safe-area padding keeps it clear of a phone's home indicator.
const ConsentBanner = () => {
  const choice = useConsentStore((state) => state.choice);
  const reopened = useConsentStore((state) => state.reopened);
  const accept = useConsentStore((state) => state.accept);
  const reject = useConsentStore((state) => state.reject);

  if (choice !== 'unset' && !reopened) return null;

  const buttonClass =
    'flex-1 sm:flex-none px-5 py-3 rounded-xl text-[10px] font-medium uppercase tracking-widest transition-colors';

  return (
    <div
      role="dialog"
      aria-label="Privacy choices"
      data-testid="consent-banner"
      className="fixed inset-x-0 bottom-0 z-50 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6"
    >
      <div className="mx-auto max-w-3xl rounded-2xl border border-ink/10 bg-background-secondary/95 backdrop-blur-xl shadow-lg p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <p className="text-text-secondary text-xs leading-relaxed">
          VYSVI keeps you signed in and remembers your settings using your browser's storage. With your permission it
          also uses optional services (ads for free accounts and error reports).{' '}
          <Link to="/privacy" className="text-text-primary underline underline-offset-2">
            Privacy Policy
          </Link>
        </p>
        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={reject}
            className={`${buttonClass} bg-ink/5 hover:bg-ink/10 text-text-primary border border-ink/10`}
          >
            Only essentials
          </button>
          <button
            type="button"
            onClick={accept}
            className={`${buttonClass} bg-ink text-background-main hover:opacity-90`}
          >
            Accept all
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConsentBanner;
