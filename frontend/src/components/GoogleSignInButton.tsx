import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

// The part of Google Identity Services we use (https://accounts.google.com/gsi/client).
interface GoogleIdApi {
  initialize: (config: { client_id: string; callback: (response: { credential?: string }) => void }) => void;
  renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
}
declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleIdApi } };
  }
}

const SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

// Adds Google's sign-in script to the page (once) and resolves when it is ready. Audit H12: this runs ONLY after the person clicks
// our own button, so merely opening the login or sign-up page contacts nobody (Google learns nothing until they choose it).
function loadGoogleScript(): Promise<GoogleIdApi> {
  const ready = () => window.google?.accounts?.id;
  const already = ready();
  if (already) return Promise.resolve(already);

  return new Promise((resolve, reject) => {
    let script = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    if (!script) {
      script = document.createElement('script');
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    script.addEventListener('load', () => {
      const api = ready();
      if (api) resolve(api);
      else reject(new Error('Google sign-in did not start'));
    });
    script.addEventListener('error', () => reject(new Error('Google sign-in could not be loaded')));
  });
}

interface GoogleSignInButtonProps {
  // The OAuth client id of this app (public).
  clientId: string;
  // Called with the signed ID token ("credential") when the person finishes signing in with Google.
  onCredential: (credential: string) => void;
  // Label of our own first button.
  label?: string;
}

// Task 98 + audit H12: "Continue with Google" in two clicks. The first click is on OUR button: only then is Google's script loaded.
// Google's own button then appears in its place and the second click opens its popup. Nothing is loaded from Google before the first click.
const GoogleSignInButton = ({ clientId, onCredential, label = 'Continue with Google' }: GoogleSignInButtonProps) => {
  const container = useRef<HTMLDivElement>(null);
  // The latest callback, so the effect below does not restart the button on every render.
  const callback = useRef(onCredential);
  useEffect(() => {
    callback.current = onCredential;
  });
  const [stage, setStage] = useState<'idle' | 'loading' | 'ready' | 'failed'>('idle');

  useEffect(() => {
    if (stage !== 'ready') return;
    loadGoogleScript()
      .then((api) => {
        if (!container.current) return;
        api.initialize({
          client_id: clientId,
          callback: (response) => {
            if (response.credential) callback.current(response.credential);
          },
        });
        api.renderButton(container.current, {
          type: 'standard',
          theme: document.documentElement.getAttribute('data-theme') === 'light' ? 'outline' : 'filled_black',
          size: 'large',
          text: 'continue_with',
          shape: 'pill',
          width: 320,
        });
      })
      .catch(() => setStage('failed'));
  }, [stage, clientId]);

  const start = () => {
    setStage('loading');
    // Load first; once the script is there, show Google's button (the effect above draws it).
    loadGoogleScript().then(() => setStage('ready')).catch(() => setStage('failed'));
  };

  if (stage === 'failed') {
    return (
      <p role="status" className="text-center text-text-secondary text-[10px] uppercase tracking-widest">
        Google sign-in could not load. You can still use your email and password.
      </p>
    );
  }
  if (stage === 'ready') {
    return <div ref={container} data-testid="google-button" className="flex justify-center min-h-[44px]" />;
  }
  return (
    <button
      type="button"
      onClick={start}
      disabled={stage === 'loading'}
      className="w-full min-h-[48px] rounded-full border border-ink/15 bg-background-secondary text-sm font-medium text-text-primary flex items-center justify-center gap-2 transition-[background-color,transform] hover:bg-ink/5 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 disabled:opacity-60"
    >
      {stage === 'loading' ? <Loader2 className="animate-spin" size={16} aria-hidden /> : null}
      <span>{label}</span>
    </button>
  );
};

export default GoogleSignInButton;
