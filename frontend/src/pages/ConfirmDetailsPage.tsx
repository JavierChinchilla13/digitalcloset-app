import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Loader2 } from 'lucide-react';
import { userService } from '../api/userService';
import AgeAndConsentFields from '../components/AgeAndConsentFields';
import { useAgeConsentForm } from '../hooks/useAgeConsentForm';
import { useAuthStore } from '../store/useAuthStore';
import { isAgeRefusal } from '../utils/ageGate';
import { getApiErrorMessage } from '../utils/apiError';
import { setLoginNotice } from '../utils/loginNotice';
import { resetAccountStores } from '../utils/resetAccountStores';

// Audit H12: accounts made before the age step ask for the same facts once: birth month/year (unless already recorded), the guardian
// declaration for 13-17 and the two acceptances. Until then the app steers every screen here (the server does not block calls).
// Under 13 the server erases the account and answers with the uniform refusal; this page then signs out and shows only that message.
const ConfirmDetailsPage = () => {
  const user = useAuthStore((state) => state.user);
  const login = useAuthStore((state) => state.login);
  const token = useAuthStore((state) => state.token);
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();

  const birthKnown = Boolean(user?.ageBand);
  const form = useAgeConsentForm({ birthKnown, knownBand: user?.ageBand ?? null });
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Nothing to confirm (already done, or a refreshed copy of the account says so): on to the app.
  if (user && !user.needsLegalConfirmation) {
    return (
      <div className="min-h-[60dvh] flex items-center justify-center p-6 text-center">
        <p className="text-text-secondary text-sm">
          Your details are confirmed. <Link to="/showcase" className="text-text-primary underline underline-offset-2">Continue</Link>
        </p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    // Unlike a new sign-up, an under-minimum answer IS sent here: this account already exists, and the server is what erases it
    // (and answers with the uniform refusal). So only the other checks are skipped for that band.
    const problem = form.band === 'UNDER_MIN' ? null : form.validate();
    if (problem) {
      setError(problem);
      return;
    }
    setIsLoading(true);
    try {
      const fresh = await userService.confirmLegal(form.payload());
      if (token) login(token, fresh);
      navigate('/showcase', { replace: true });
    } catch (err) {
      if (isAgeRefusal(err)) {
        // The server erased the account: sign out, forget everything stored here, show only the uniform message.
        form.block();
        resetAccountStores();
        logout();
        setLoginNotice('age-refused');
        navigate('/login', { replace: true });
      } else {
        setError(getApiErrorMessage(err, "Couldn't save your details. Please try again."));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[80dvh] flex items-center justify-center p-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-light tracking-tighter mb-4 uppercase text-text-primary text-balance">Confirm your details</h1>
          <p className="text-text-secondary text-sm leading-relaxed text-pretty">
            We added a few questions since you joined. Please answer them once to keep using your account.
          </p>
        </div>

        {error && (
          <div role="alert" className="mb-8 p-4 bg-red-500/10 border border-red-500/50 rounded-2xl text-text-primary text-xs font-bold text-center uppercase tracking-widest">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <AgeAndConsentFields form={form} idPrefix="confirm" birthKnown={birthKnown} disabled={isLoading} />
          <button
            type="submit"
            disabled={isLoading}
            className="w-full min-h-[48px] py-4 bg-accent text-on-accent font-medium rounded-2xl flex items-center justify-center gap-2 transition-[transform,opacity] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="animate-spin" size={18} /> : (<><span>CONFIRM AND CONTINUE</span><ArrowRight size={18} /></>)}
          </button>
        </form>

        <p className="mt-8 text-center text-text-secondary text-sm">
          Prefer not to?{' '}
          <Link to="/settings" className="text-text-primary underline underline-offset-2 hover:text-accent">Delete my account</Link>
        </p>
      </motion.div>
    </div>
  );
};

export default ConfirmDetailsPage;
