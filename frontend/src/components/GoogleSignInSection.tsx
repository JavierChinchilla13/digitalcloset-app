import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { authService } from '../api/authService';
import { useCompleteSignIn } from '../hooks/useCompleteSignIn';
import { getApiErrorMessage } from '../utils/apiError';
import GoogleSignInButton from './GoogleSignInButton';

// Task 98: the "or continue with Google" block under the login and signup forms. It shows nothing
// unless this build has a Google client id (VITE_GOOGLE_CLIENT_ID), so the site works the same
// without Google set up. The whole flow lives here: Google's token goes to the backend
// (POST /auth/google), which answers with this app's own token, and signing in finishes like the
// password form does. A failure is passed to the page's own error box through `onError`.
const GoogleSignInSection = ({ onError }: { onError: (message: string | null) => void }) => {
  const clientId = String(import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '').trim();
  const completeSignIn = useCompleteSignIn();
  const [isBusy, setIsBusy] = useState(false);

  if (!clientId) return null;

  const handleCredential = async (credential: string) => {
    setIsBusy(true);
    onError(null);
    try {
      const response = await authService.google(credential);
      await completeSignIn(response.token);
    } catch (err) {
      onError(getApiErrorMessage(err, "Couldn't sign you in with Google. Please try again."));
      console.error('Google sign-in error:', err);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="mt-8 space-y-6">
      <div className="flex items-center gap-4" aria-hidden>
        <div className="h-px flex-1 bg-ink/10" />
        <span className="text-[10px] font-medium tracking-[0.3em] text-text-secondary uppercase">or</span>
        <div className="h-px flex-1 bg-ink/10" />
      </div>
      <div className={`relative ${isBusy ? 'opacity-50 pointer-events-none' : ''}`}>
        <GoogleSignInButton clientId={clientId} onCredential={handleCredential} />
        {isBusy && <Loader2 className="absolute inset-0 m-auto animate-spin text-accent" size={20} />}
      </div>
    </div>
  );
};

export default GoogleSignInSection;
