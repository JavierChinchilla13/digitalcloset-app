import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Loader2, Trash2 } from 'lucide-react';
import { userService } from '../api/userService';
import { useAuthStore } from '../store/useAuthStore';
import { getApiErrorMessage } from '../utils/apiError';
import { setLoginNotice } from '../utils/loginNotice';
import { resetAccountStores } from '../utils/resetAccountStores';
import { useToast } from './Toast';
import GoogleSignInButton from './GoogleSignInButton';
import PasswordInput from './PasswordInput';
import { useT } from '../i18n';

// Audit H12: the two rights every account has in Settings: "Download my data" (a JSON file of everything held about the account) and
// "Delete my account and data" (permanent; replaces the old deactivation). Deleting asks for proof it is really the owner: the password,
// or, for an account that only signs in with Google, a fresh Google sign-in (the Google script loads only when that button is clicked).
const AccountDataSection = () => {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { t } = useT();
  const googleClientId = String(import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '').trim();
  // Only a confirmed-false hasPassword means Google-only (an older copy of the account without the field is treated as having one).
  const googleOnly = user?.hasPassword === false;

  const [isExporting, setIsExporting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [password, setPassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmed = typed === 'DELETE';

  const download = async () => {
    setIsExporting(true);
    try {
      const blob = await userService.exportMyData();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'vysvi-my-data.json';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      showToast(getApiErrorMessage(err, t('data.downloadFailed')), 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const erase = async (proof: { password?: string; googleCredential?: string }) => {
    setIsDeleting(true);
    setError(null);
    try {
      await userService.deleteAccount(proof);
      // The notice is kept for the login page (signing out lets the route guard send the page there itself).
      setLoginNotice('account-deleted');
      logout();
      resetAccountStores();
      navigate('/login', { replace: true });
    } catch (err) {
      setError(getApiErrorMessage(err, t('data.deleteFailed')));
      setIsDeleting(false);
    }
  };

  const submitPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (confirmed && password) void erase({ password });
  };

  const close = () => {
    setIsOpen(false);
    setTyped('');
    setPassword('');
    setError(null);
  };

  const field =
    'w-full min-h-[48px] bg-background-secondary border border-ink/5 rounded-xl py-3 px-4 text-sm text-text-primary focus:outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-accent/60 disabled:opacity-50';
  const ghost =
    'w-full min-h-[44px] py-3 bg-ink/5 hover:bg-ink/10 text-text-primary text-[10px] font-medium uppercase tracking-widest rounded-xl inline-flex items-center justify-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 disabled:opacity-50';

  return (
    <div className="pt-4 border-t border-ink/5 space-y-6" data-testid="account-data-section">
      <div className="space-y-2">
        <p className="text-text-secondary text-xs leading-relaxed normal-case tracking-normal">
          {t('data.intro')}
        </p>
        <button type="button" onClick={download} disabled={isExporting} className={ghost}>
          {isExporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} {t('data.download')}
        </button>
      </div>

      {!isOpen ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="w-full min-h-[44px] py-3.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[10px] font-medium uppercase tracking-widest rounded-xl flex items-center justify-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60"
        >
          <Trash2 size={14} /> {t('data.delete')}
        </button>
      ) : (
        <form onSubmit={submitPassword} className="space-y-4" aria-labelledby="delete-title">
          <div className="space-y-1">
            <h3 id="delete-title" className="text-sm font-medium text-text-primary normal-case tracking-normal">
              {t('data.delete')}
            </h3>
            <p className="text-text-secondary text-xs leading-relaxed normal-case tracking-normal">
              {t('data.deleteText')}
            </p>
          </div>

          <div className="space-y-1">
            <label htmlFor="delete-confirm" className="block text-xs text-text-secondary normal-case tracking-normal">
              {t('data.typeDelete')}
            </label>
            <input
              id="delete-confirm"
              type="text"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              disabled={isDeleting}
              className={field}
            />
          </div>

          {googleOnly ? (
            <div className="space-y-2">
              <p className="text-xs text-text-secondary normal-case tracking-normal">
                {t('data.googleIntro')}
              </p>
              {googleClientId ? (
                <div className={confirmed && !isDeleting ? '' : 'opacity-50 pointer-events-none'} aria-disabled={!confirmed || isDeleting}>
                  <GoogleSignInButton
                    clientId={googleClientId}
                    label={t('data.googleConfirm')}
                    onCredential={(googleCredential) => {
                      if (confirmed) void erase({ googleCredential });
                    }}
                  />
                </div>
              ) : (
                <p role="alert" className="text-xs text-rose-400 normal-case tracking-normal">
                  {t('data.googleUnavailable')}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              <label htmlFor="delete-password" className="block text-xs text-text-secondary normal-case tracking-normal">
                {t('data.password')}
              </label>
              <PasswordInput
                id="delete-password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isDeleting}
                className={`${field} pr-12`}
              />
            </div>
          )}

          {error && (
            <p role="alert" className="text-xs text-rose-400 normal-case tracking-normal">
              {error}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={close} disabled={isDeleting} className={ghost}>
              {t('common.cancel')}
            </button>
            {!googleOnly && (
              <button
                type="submit"
                disabled={!confirmed || !password || isDeleting}
                className="min-h-[44px] py-3 bg-red-500 hover:bg-red-600 text-white text-[10px] font-medium uppercase tracking-widest rounded-xl flex items-center justify-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60 disabled:opacity-50"
              >
                {isDeleting ? <Loader2 size={14} className="animate-spin" /> : t('data.everything')}
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
};

export default AccountDataSection;
