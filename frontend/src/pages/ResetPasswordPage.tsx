import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useSearchParams } from 'react-router-dom';
import { authService } from '../api/authService';
import { Lock, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';
import PasswordInput from '../components/PasswordInput';
import { getApiErrorMessage } from '../utils/apiError';
import { useT } from '../i18n';

// Same minimum the server enforces on reset (ResetPasswordRequest).
const MIN_PASSWORD_LENGTH = 8;

// Step 2 of password reset (Task 21): the page the emailed link opens
// (/reset-password?token=...). Sets the new password, then sends the user to
// sign in - it deliberately doesn't sign them in itself.
const ResetPasswordPage = () => {
  const { t } = useT();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Only a server-side rejection means the link itself is bad (worth offering a
  // new one); a typo in the form is fixed in place.
  const [linkRejected, setLinkRejected] = useState(false);
  const [doneMessage, setDoneMessage] = useState<string | null>(null);

  // Checks length and confirmation locally, then sends the token and new password; a server rejection means the link is bad.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLinkRejected(false);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(t('reset.tooShort', { min: MIN_PASSWORD_LENGTH }));
      return;
    }
    if (password !== confirm) {
      setError(t('reset.mismatch'));
      return;
    }

    setIsLoading(true);
    try {
      const response = await authService.resetPassword(token, password);
      setDoneMessage(response.message);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, t('error.generic')));
      setLinkRejected((err as { response?: { status?: number } }).response?.status === 400);
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass =
    'w-full bg-background-secondary border border-ink/5 rounded-2xl py-4 pl-14 pr-12 text-sm text-text-primary focus:outline-none focus:border-accent/50 focus:bg-background-secondary/80 transition-all';

  return (
    <div className="min-h-[80dvh] flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-12">
          <h1 className="text-4xl font-light tracking-tighter mb-4 uppercase text-text-primary">{t('reset.title')}</h1>
          <p className="text-text-secondary text-sm tracking-widest uppercase opacity-60">
            {t('reset.subtitle')}
          </p>
        </div>

        {doneMessage ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 bg-accent/5 border border-accent/20 rounded-2xl text-center space-y-6"
          >
            <CheckCircle2 className="mx-auto text-accent" size={32} />
            <p className="text-text-primary text-sm leading-relaxed">{doneMessage}</p>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 py-3 px-6 bg-ink text-background-main font-medium rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              <span>{t('login.submit')}</span>
              <ArrowRight size={16} />
            </Link>
          </motion.div>
        ) : !token ? (
          <div className="p-6 bg-red-500/10 border border-red-500/50 rounded-2xl text-center space-y-4">
            <p className="text-red-400 text-xs font-bold uppercase tracking-widest">
              {t('reset.missingToken')}
            </p>
            <Link to="/forgot-password" className="text-text-primary text-sm font-bold hover:text-accent transition-colors">
              {t('reset.requestNew')}
            </Link>
          </div>
        ) : (
          <>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mb-8 p-4 bg-red-500/10 border border-red-500/50 rounded-2xl text-red-400 text-xs font-bold text-center uppercase tracking-widest"
              >
                {error}
                {linkRejected && (
                  <div className="mt-2 normal-case tracking-normal font-medium">
                    <Link to="/forgot-password" className="underline hover:text-red-300">
                      {t('reset.requestNew')}
                    </Link>
                  </div>
                )}
              </motion.div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-medium tracking-[0.3em] text-accent uppercase pl-4">{t('reset.newPassword')}</label>
                <PasswordInput
                  icon={Lock}
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('reset.newPlaceholder')}
                  className={inputClass}
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-medium tracking-[0.3em] text-accent uppercase pl-4">{t('reset.confirmPassword')}</label>
                <PasswordInput
                  icon={Lock}
                  required
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder={t('reset.confirmPlaceholder')}
                  className={inputClass}
                  disabled={isLoading}
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 bg-ink text-background-main font-medium rounded-2xl flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md shadow-ink/5 group disabled:opacity-50 disabled:hover:scale-100"
              >
                {isLoading ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <>
                    <span>{t('reset.submit')}</span>
                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>
          </>
        )}
      </motion.div>
    </div>
  );
};

export default ResetPasswordPage;
