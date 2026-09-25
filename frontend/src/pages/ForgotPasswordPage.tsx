import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { authService } from '../api/authService';
import { Mail, ArrowRight, Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react';

// Step 1 of password reset (Task 21): ask for a reset link. The backend
// answers identically whether or not the email has an account, so this page
// does too - it never says "no such user".
const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentMessage, setSentMessage] = useState<string | null>(null);
  // The address exactly as submitted, echoed back on the confirmation so a
  // typo is obvious. It's the user's own input - it says nothing about
  // whether an account exists for it.
  const [sentTo, setSentTo] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const submitted = email.trim();
      const response = await authService.forgotPassword(submitted);
      setSentTo(submitted);
      setSentMessage(response.message);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-12">
          <h1 className="text-4xl font-light tracking-tighter mb-4 uppercase text-text-primary">Reset Password</h1>
          <p className="text-text-secondary text-sm tracking-widest uppercase opacity-60">
            We'll email you a link to choose a new one
          </p>
        </div>

        {sentMessage ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 bg-accent/5 border border-accent/20 rounded-2xl text-center space-y-4"
          >
            <CheckCircle2 className="mx-auto text-accent" size={32} />
            <p className="text-text-primary text-sm leading-relaxed">{sentMessage}</p>

            <div className="rounded-xl bg-background-secondary border border-ink/5 px-4 py-3 space-y-1">
              <p className="text-text-secondary text-[10px] tracking-[0.3em] uppercase">You entered</p>
              <p className="text-text-primary text-sm font-medium break-all">{sentTo}</p>
            </div>

            <p className="text-text-secondary text-[10px] tracking-widest uppercase">
              The link expires in 30 minutes
            </p>

            <button
              type="button"
              onClick={() => setSentMessage(null)}
              className="text-text-secondary text-xs hover:text-text-primary underline underline-offset-4 transition-colors"
            >
              Wrong email? Try again
            </button>
          </motion.div>
        ) : (
          <>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mb-8 p-4 bg-red-500/10 border border-red-500/50 rounded-2xl text-red-400 text-xs font-bold text-center uppercase tracking-widest"
              >
                {error}
              </motion.div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-medium tracking-[0.3em] text-accent uppercase pl-4">Email Address</label>
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

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 bg-ink text-background-main font-medium rounded-2xl flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md shadow-ink/5 group disabled:opacity-50 disabled:hover:scale-100"
              >
                {isLoading ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <>
                    <span>SEND RESET LINK</span>
                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>
          </>
        )}

        <div className="mt-12 text-center">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-text-secondary text-sm hover:text-text-primary transition-colors"
          >
            <ArrowLeft size={14} />
            Back to sign in
          </Link>
        </div>
      </motion.div>
    </div>
  );
};

export default ForgotPasswordPage;
