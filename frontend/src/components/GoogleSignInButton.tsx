import { useEffect, useRef, useState } from 'react';

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

// Adds Google's sign-in script to the page (once) and resolves when it is ready. Only the login and
// signup pages call this, so no other page loads anything from Google.
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
}

// Task 98: Google's own "Continue with Google" button. Google draws it and runs the sign-in popup; all
// this component does is load the script, start it with our client id and hand the resulting token up.
const GoogleSignInButton = ({ clientId, onCredential }: GoogleSignInButtonProps) => {
  const container = useRef<HTMLDivElement>(null);
  // The latest callback, so the effect below does not restart the button on every render.
  const callback = useRef(onCredential);
  callback.current = onCredential;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadGoogleScript()
      .then((api) => {
        if (cancelled || !container.current) return;
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
      .catch(() => {
        // Blocked by a browser extension or no connection to Google.
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  if (failed) {
    return (
      <p role="status" className="text-center text-text-secondary text-[10px] uppercase tracking-widest">
        Google sign-in could not load. You can still use your email and password.
      </p>
    );
  }
  return <div ref={container} data-testid="google-button" className="flex justify-center min-h-[44px]" />;
};

export default GoogleSignInButton;
