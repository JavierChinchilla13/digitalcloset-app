import { useEffect, useState } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
import { authService, type GoogleCompleteRequest } from '../api/authService';
import { useCompleteSignIn } from '../hooks/useCompleteSignIn';
import { useAgeConsentForm } from '../hooks/useAgeConsentForm';
import { getApiErrorMessage } from '../utils/apiError';
import { AGE_BLOCKED_MESSAGE, isAgeRefusal } from '../utils/ageGate';
import AgeAndConsentFields from './AgeAndConsentFields';
import GoogleSignInButton from './GoogleSignInButton';

// Task 98 + audit H12: the "or continue with Google" block under the login and signup forms. It shows nothing unless this build has a
// Google client id (VITE_GOOGLE_CLIENT_ID). Google's script loads only after the person clicks (see GoogleSignInButton).
// Step 1: Google's token goes to POST /auth/google. Someone who already has an account just signs in. For a NEW identity the server
// creates nothing and answers needsProfile; step 2 (below) then asks the birth month/year and the acceptances and calls
// POST /auth/google/complete with the same credential. A failure is passed to the page's own error box through `onError`.
// `onStep2Change` tells the page when step 2 opens or closes, so the sign-up page can hide its own form meanwhile (one form at a time).
const GoogleSignInSection = ({
  onError,
  onStep2Change,
}: {
  onError: (message: string | null) => void;
  onStep2Change?: (open: boolean) => void;
}) => {
  const clientId = String(import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '').trim();
  const completeSignIn = useCompleteSignIn();
  const [isBusy, setIsBusy] = useState(false);
  // Set when step 1 says this Google identity is new: the credential is kept in memory only, for step 2.
  const [pending, setPending] = useState<{ credential: string; email: string } | null>(null);
  const form = useAgeConsentForm();
  const [stepError, setStepError] = useState<string | null>(null);
  const isStep2 = pending !== null;
  useEffect(() => {
    onStep2Change?.(isStep2);
  }, [isStep2, onStep2Change]);

  if (!clientId) return null;

  const handleCredential = async (credential: string) => {
    setIsBusy(true);
    onError(null);
    try {
      const response = await authService.google(credential);
      if (response.needsProfile) {
        setPending({ credential, email: response.email ?? '' });
      } else if (response.token) {
        await completeSignIn(response.token);
      }
    } catch (err) {
      onError(getApiErrorMessage(err, "Couldn't sign you in with Google. Please try again."));
      console.error('Google sign-in error:', err);
    } finally {
      setIsBusy(false);
    }
  };

  const handleComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pending) return;
    setStepError(null);
    // Under the minimum age: refuse here with the one uniform message and send nothing at all.
    if (form.band === 'UNDER_MIN') {
      form.block();
      setStepError(AGE_BLOCKED_MESSAGE);
      return;
    }
    const problem = form.validate();
    if (problem) {
      setStepError(problem);
      return;
    }
    setIsBusy(true);
    try {
      // Here the birth fields are always present (this form never starts with a recorded birth date).
      const response = await authService.googleComplete({ credential: pending.credential, ...form.payload() } as GoogleCompleteRequest);
      await completeSignIn(response.token);
    } catch (err) {
      if (isAgeRefusal(err)) {
        form.block();
        setStepError(AGE_BLOCKED_MESSAGE);
      } else {
        setStepError(getApiErrorMessage(err, "Couldn't create your account with Google. Please try again."));
      }
    } finally {
      setIsBusy(false);
    }
  };

  // Step 2: a new Google identity. Nothing has been created yet.
  if (pending) {
    return (
      <form onSubmit={handleComplete} className="mt-8 space-y-6" aria-labelledby="google-step2-title">
        <div className="space-y-1">
          <h2 id="google-step2-title" className="text-lg font-light tracking-tight text-text-primary">One more step</h2>
          <p className="text-sm text-text-secondary">
            Google confirmed <span className="text-text-primary break-all">{pending.email}</span>. Your account is created after you finish
            here.
          </p>
        </div>
        {stepError && (
          <div role="alert" className="p-4 bg-red-500/10 border border-red-500/50 rounded-2xl text-text-primary text-xs font-bold text-center uppercase tracking-widest">
            {stepError}
          </div>
        )}
        <AgeAndConsentFields form={form} idPrefix="google" disabled={isBusy} />
        <button
          type="submit"
          disabled={isBusy || form.blocked}
          className="w-full min-h-[48px] py-4 bg-accent text-on-accent font-medium rounded-2xl flex items-center justify-center gap-2 transition-[transform,opacity] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 disabled:opacity-50"
        >
          {isBusy ? <Loader2 className="animate-spin" size={18} /> : (<><span>CREATE ACCOUNT</span><ArrowRight size={18} /></>)}
        </button>
      </form>
    );
  }

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
      <p className="text-center text-text-secondary text-[10px] tracking-widest uppercase opacity-60">
        Choosing Google loads a script from Google.
      </p>
    </div>
  );
};

export default GoogleSignInSection;
