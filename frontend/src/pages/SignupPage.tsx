import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { authService, type RegisterRequest } from '../api/authService';
import AgeAndConsentFields from '../components/AgeAndConsentFields';
import { useAgeConsentForm } from '../hooks/useAgeConsentForm';
import { ageBlockedMessage, isAgeRefusal } from '../utils/ageGate';
import { useT } from '../i18n';
import { Mail, Lock, ArrowRight, Loader2 } from 'lucide-react';
import PasswordInput from '../components/PasswordInput';
import GoogleSignInSection from '../components/GoogleSignInSection';
import { useCompleteSignIn } from '../hooks/useCompleteSignIn';
import { getApiErrorMessage } from '../utils/apiError';

// Account creation form. Registering signs the user in straight away (the backend returns a token).
const SignupPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const completeSignIn = useCompleteSignIn();
  const { t } = useT();
  // Audit H12: birth month/year, guardian declaration (13-17) and the two acceptances.
  const ageForm = useAgeConsentForm();
  // True while a new Google sign-up is on its second step: that step has its own age/consent fields, so this form steps aside.
  const [googleStep, setGoogleStep] = useState(false);

  // Registers, then (completeSignIn) fetches the profile, stores the session and lands on the Showcase.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Under the minimum age: the one uniform refusal, nothing is sent (the server would refuse it the same way).
    if (ageForm.band === 'UNDER_MIN' || ageForm.blocked) {
      ageForm.block();
      setError(ageBlockedMessage());
      return;
    }
    const problem = ageForm.validate();
    if (problem) {
      setError(problem);
      return;
    }

    setIsLoading(true);
    try {
      const response = await authService.register({ email, password, firstName, lastName, ...ageForm.payload() } as RegisterRequest);
      await completeSignIn(response.token);
    } catch (err: unknown) {
      if (isAgeRefusal(err)) {
        ageForm.block();
        setError(ageBlockedMessage());
      } else {
        setError(getApiErrorMessage(err, t('signup.failed')));
      }
      console.error('Signup error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[80dvh] flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-12">
          <h1 className="text-4xl font-light tracking-tighter mb-4 uppercase text-text-primary">{t('signup.title')}</h1>
          <p className="text-text-secondary text-sm tracking-widest uppercase opacity-60">{t('signup.subtitle')}</p>
        </div>

        {error && (
          <motion.div 
            role="alert"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mb-8 p-4 bg-red-500/10 border border-red-500/50 rounded-2xl text-text-primary text-xs font-bold text-center uppercase tracking-widest"
          >
            {error}
          </motion.div>
        )}

        {!googleStep && (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-medium tracking-[0.3em] text-accent uppercase pl-4">{t('field.firstName')}</label>
              <input 
                type="text" 
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Alexander"
                className="w-full bg-background-secondary border border-ink/5 rounded-2xl py-4 px-6 text-sm text-text-primary focus:outline-none focus:border-accent/50 focus:bg-background-secondary/80 transition-all"
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-medium tracking-[0.3em] text-accent uppercase pl-4">{t('field.lastName')}</label>
              <input 
                type="text" 
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="McQueen"
                className="w-full bg-background-secondary border border-ink/5 rounded-2xl py-4 px-6 text-sm text-text-primary focus:outline-none focus:border-accent/50 focus:bg-background-secondary/80 transition-all"
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-medium tracking-[0.3em] text-accent uppercase pl-4">{t('field.email')}</label>
            <div className="relative group">
              <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-text-secondary group-focus-within:text-accent transition-colors" size={18} />
              <input 
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="fashion@example.com"
                className="w-full bg-background-secondary border border-ink/5 rounded-2xl py-4 pl-14 pr-6 text-sm text-text-primary focus:outline-none focus:border-accent/50 focus:bg-background-secondary/80 transition-all"
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-medium tracking-[0.3em] text-accent uppercase pl-4">{t('field.password')}</label>
            <PasswordInput
              icon={Lock}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-background-secondary border border-ink/5 rounded-2xl py-4 pl-14 pr-12 text-sm text-text-primary focus:outline-none focus:border-accent/50 focus:bg-background-secondary/80 transition-all"
              disabled={isLoading}
            />
          </div>

          <AgeAndConsentFields form={ageForm} idPrefix="signup" disabled={isLoading} />

          <button
            type="submit"
            disabled={isLoading || ageForm.blocked}
            className="w-full py-4 bg-accent text-on-accent font-medium rounded-2xl flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md group disabled:opacity-50 disabled:hover:scale-100"
          >
            {isLoading ? (
              <Loader2 className="animate-spin" size={18} />
            ) : (
              <>
                <span>{t('signup.submit')}</span>
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>
        )}

        <GoogleSignInSection onError={setError} onStep2Change={setGoogleStep} />

        <div className="mt-12 text-center">
          <p className="text-text-secondary text-sm">
            {t('signup.haveAccount')} {' '}
            <Link to="/login" className="text-text-primary font-bold hover:text-accent transition-colors">{t('signup.signInHere')}</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default SignupPage;
