import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useSearchParams } from 'react-router-dom';
import { authService } from '../api/authService';
import { Lock, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';

const MIN_PASSWORD_LENGTH = 8;

// Step 2 of password reset (Task 21): the page the emailed link opens
// (/reset-password?token=...). Sets the new password, then sends the user to
// sign in - it deliberately doesn't sign them in itself.
const ResetPasswordPage = () => {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLinkRejected(false);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await authService.resetPassword(token, password);
      setDoneMessage(response.message);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
      setLinkRejected(err.response?.status === 400);
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass =
    'w-full bg-background-secondary border border-ink/5 rounded-2xl py-4 pl-14 pr-6 text-sm text-text-primary focus:outline-none focus:border-accent/50 focus:bg-background-secondary/80 transition-all';

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-12">
          <h1 className="text-4xl font-light tracking-tighter mb-4 uppercase text-text-primary">New Password</h1>
          <p className="text-text-secondary text-sm tracking-widest uppercase opacity-60">
            Choose something you'll remember
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
              <span>SIGN IN</span>
              <ArrowRight size={16} />
            </Link>
          </motion.div>
        ) : !token ? (
          <div className="p-6 bg-red-500/10 border border-red-500/50 rounded-2xl text-center space-y-4">
            <p className="text-red-400 text-xs font-bold uppercase tracking-widest">
              This reset link is missing its token
            </p>
            <Link to="/forgot-password" className="text-text-primary text-sm font-bold hover:text-accent transition-colors">
              Request a new link
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
                      Request a new link
                    </Link>
                  </div>
                )}
              </motion.div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-medium tracking-[0.3em] text-accent uppercase pl-4">New Password</label>
                <div className="relative group">
                  <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-text-secondary group-focus-within:text-accent transition-colors" size={18} />
                  <input
                    type="password"
                    required
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className={inputClass}
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-medium tracking-[0.3em] text-accent uppercase pl-4">Confirm Password</label>
                <div className="relative group">
                  <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-text-secondary group-focus-within:text-accent transition-colors" size={18} />
                  <input
                    type="password"
                    required
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Repeat your new password"
                    className={inputClass}
                    disabled={isLoading}
                  />
                </div>
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
                    <span>UPDATE PASSWORD</span>
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
