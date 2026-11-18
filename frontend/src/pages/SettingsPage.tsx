import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2, Mail, Settings as SettingsIcon, Shield, User as UserIcon } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import AccountDataSection from '../components/AccountDataSection';
import { useToast } from '../components/Toast';
import { userService } from '../api/userService';
import { authService } from '../api/authService';
import SectionWrapper from '../components/SectionWrapper';
import PasswordInput from '../components/PasswordInput';
import { Plan, Role } from '../types';
import StorageMeter from '../components/StorageMeter';
import BillingActions from '../components/BillingActions';
import PremiumInterestNote from '../components/PremiumInterestNote';
import { useBillingStore } from '../store/useBillingStore';
import { getApiErrorMessage } from '../utils/apiError';
import { useT } from '../i18n';

// Task 79: account settings - name, email, password, and account status.
// Each section is its own small form with its own loading/error state, so
// one failing save never blocks the others. Persona display names already
// have a home on /persona (CLAUDE.md: don't duplicate functionality) - this
// page links there instead of repeating that form.
const fieldClass =
  'w-full px-5 py-4 bg-ink/[0.02] border border-ink/5 rounded-2xl text-text-primary placeholder:text-text-secondary/50 text-sm focus:outline-none focus:border-accent/50 transition-all disabled:opacity-50';
// Same as fieldClass, with room on the right for PasswordInput's show/hide toggle.
const passwordFieldClass = 'w-full pl-5 pr-12 py-4 bg-ink/[0.02] border border-ink/5 rounded-2xl text-text-primary placeholder:text-text-secondary/50 text-sm focus:outline-none focus:border-accent/50 transition-all disabled:opacity-50';
const labelClass = 'text-[10px] font-medium tracking-[0.3em] text-accent uppercase pl-4';

const SectionCard = ({
  icon: Icon,
  title,
  description,
  testId,
  children,
}: {
  icon: typeof UserIcon;
  title: string;
  description: string;
  testId: string;
  children: React.ReactNode;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    data-testid={testId}
    className="bg-background-secondary border border-ink/5 rounded-2xl p-8 space-y-6"
  >
    <div className="flex items-center gap-3">
      <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center text-accent">
        <Icon size={16} />
      </div>
      <div>
        <h2 className="text-text-primary text-sm font-medium uppercase tracking-widest">{title}</h2>
        <p className="text-text-secondary text-[10px] uppercase tracking-widest opacity-50">{description}</p>
      </div>
    </div>
    {children}
  </motion.div>
);

// The shared "enter the code we emailed you" step for both the Email and
// Password cards - a single plain text input (inputMode="numeric"), not a
// multi-box OTP widget, matching this app's "avoid oversized/fussy UI" rule.
const CodeConfirmStep = ({
  targetEmail,
  code,
  onCodeChange,
  onConfirm,
  onResend,
  onCancel,
  isBusy,
  confirmLabel,
}: {
  targetEmail?: string;
  code: string;
  onCodeChange: (value: string) => void;
  onConfirm: (e: React.FormEvent) => void;
  onResend: () => void;
  onCancel: () => void;
  isBusy: boolean;
  confirmLabel: string;
}) => {
  const { t } = useT();
  return (
  <form onSubmit={onConfirm} className="space-y-4">
    <p className="text-text-secondary text-xs leading-relaxed">
      {t.rich('settings.codeIntro', { email: (text) => <span className="text-text-primary">{text}</span> }, { email: targetEmail ?? '' })}
    </p>
    <div className="space-y-2">
      <label className={labelClass}>{t('settings.codeLabel')}</label>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        required
        maxLength={6}
        value={code}
        onChange={(e) => onCodeChange(e.target.value.replace(/\D/g, ''))}
        placeholder="123456"
        disabled={isBusy}
        className={`${fieldClass} text-center tracking-[0.5em]`}
      />
    </div>
    <button
      type="submit"
      disabled={isBusy || code.length !== 6}
      className="w-full py-3.5 bg-ink text-background-main text-[10px] font-medium uppercase tracking-widest rounded-xl flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50"
    >
      {isBusy ? <Loader2 size={14} className="animate-spin" /> : confirmLabel}
    </button>
    <div className="flex justify-between text-[10px] font-medium uppercase tracking-widest">
      <button type="button" onClick={onCancel} disabled={isBusy} className="text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50">
        {t('common.cancel')}
      </button>
      <button type="button" onClick={onResend} disabled={isBusy} className="text-accent hover:text-accent-hover transition-colors disabled:opacity-50">
        {t('settings.resend')}
      </button>
    </div>
  </form>
  );
};

const SettingsPage = () => {
  const { user, login, setToken } = useAuthStore();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t, language } = useT();

  // Task 103: back from Stripe Checkout (?billing=success). The plan changes when Stripe's webhook reaches
  // the server, which can be a few seconds (or a sleeping free-tier API's minute) after the buyer returns,
  // so the account is re-read until it shows Premium. Never trusts the URL itself.
  const returnedFromCheckout = searchParams.get('billing') === 'success';
  const [confirmingUpgrade, setConfirmingUpgrade] = useState(returnedFromCheckout);
  useEffect(() => {
    if (!returnedFromCheckout) return;
    let cancelled = false;
    let attempts = 0;
    const poll = async () => {
      attempts += 1;
      try {
        const fresh = await authService.getCurrentUser();
        if (cancelled) return;
        if (fresh.plan === Plan.PREMIUM) {
          const token = useAuthStore.getState().token;
          if (token) useAuthStore.getState().login(token, fresh);
          void useBillingStore.getState().load(true);
          setConfirmingUpgrade(false);
          setSearchParams({}, { replace: true });
          showToast(t('settings.premiumWelcome'), 'success');
          return;
        }
      } catch {
        // Keep waiting: a sleeping API answers after a while.
      }
      if (cancelled) return;
      if (attempts >= 20) {
        setConfirmingUpgrade(false);
        setSearchParams({}, { replace: true });
        showToast(t('settings.paymentPending'), 'info');
        return;
      }
      setTimeout(poll, 3000);
    };
    void poll();
    return () => {
      cancelled = true;
    };
    // Runs once for the visit that came back from Stripe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [returnedFromCheckout]);

  // --- Profile (name) ---
  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    try {
      const updated = await userService.updateProfile({ firstName, lastName });
      login(useAuthStore.getState().token!, updated);
      showToast(t('settings.profile.saved'), 'success');
    } catch (err: unknown) {
      showToast(getApiErrorMessage(err, t('settings.profile.failed')), 'error');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // --- Email (request -> emailed code -> confirm) ---
  // "for more security": a hijacked session alone can no longer change the
  // email - the code only ever reaches the account's already-verified
  // current inbox, so the real owner has to still control it.
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [emailStep, setEmailStep] = useState<'form' | 'code'>('form');
  const [emailCode, setEmailCode] = useState('');
  const [isSavingEmail, setIsSavingEmail] = useState(false);

  const doRequestEmail = async () => {
    setIsSavingEmail(true);
    try {
      await userService.requestEmailChange(newEmail, emailPassword);
      setEmailStep('code');
      showToast(t('settings.codeSentTo', { email: user?.email ?? '' }), 'success');
    } catch (err: unknown) {
      showToast(getApiErrorMessage(err, t('settings.email.startFailed')), 'error');
    } finally {
      setIsSavingEmail(false);
    }
  };

  const requestEmail = (e: React.FormEvent) => {
    e.preventDefault();
    void doRequestEmail();
  };

  const confirmEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingEmail(true);
    try {
      const auth = await userService.confirmEmailChange(emailCode);
      // Email is the login identifier, so the old token stops working the
      // instant this succeeds - set the new one first (same order
      // SignupPage uses) so the getCurrentUser() call below authenticates
      // with it instead of the now-dead old token.
      setToken(auth.token);
      const refreshed = await authService.getCurrentUser();
      login(auth.token, refreshed);
      resetEmailCard();
      showToast(t('settings.email.updated'), 'success');
    } catch (err: unknown) {
      showToast(getApiErrorMessage(err, t('settings.codeConfirmFailed')), 'error');
    } finally {
      setIsSavingEmail(false);
    }
  };

  const resetEmailCard = () => {
    setNewEmail('');
    setEmailPassword('');
    setEmailCode('');
    setEmailStep('form');
  };

  // --- Password (request -> emailed code -> confirm) ---
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordStep, setPasswordStep] = useState<'form' | 'code'>('form');
  const [passwordCode, setPasswordCode] = useState('');
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  const doRequestPassword = async () => {
    setIsSavingPassword(true);
    try {
      await userService.requestPasswordChange(currentPassword, newPassword);
      setPasswordStep('code');
      showToast(t('settings.codeSentTo', { email: user?.email ?? '' }), 'success');
    } catch (err: unknown) {
      showToast(getApiErrorMessage(err, t('settings.password.startFailed')), 'error');
    } finally {
      setIsSavingPassword(false);
    }
  };

  const requestPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      showToast(t('settings.password.mismatch'), 'error');
      return;
    }
    void doRequestPassword();
  };

  const confirmPasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingPassword(true);
    try {
      const auth = await userService.confirmPasswordChange(passwordCode);
      // The password change signed every older token out, this session's too: carry on with the new one
      // (set first, so the getCurrentUser() call below authenticates with it - same order as the email change).
      setToken(auth.token);
      const refreshed = await authService.getCurrentUser();
      login(auth.token, refreshed);
      resetPasswordCard();
      showToast(t('settings.password.updated'), 'success');
    } catch (err: unknown) {
      showToast(getApiErrorMessage(err, t('settings.codeConfirmFailed')), 'error');
    } finally {
      setIsSavingPassword(false);
    }
  };

  const resetPasswordCard = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordCode('');
    setPasswordStep('form');
  };

  const formatDate = (value?: string) =>
    value
      ? new Date(value).toLocaleDateString(language === 'es' ? 'es' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : t('settings.unknown');

  return (
    <div className="min-h-dvh bg-background-main pt-24 pb-20">
      <SectionWrapper>
        <div className="space-y-4 mb-10">
          <p className="flex items-center gap-2 text-[10px] font-medium tracking-[0.3em] text-accent uppercase">
            <SettingsIcon size={14} /> {t('settings.eyebrow')}
          </p>
          <h1 className="text-4xl sm:text-6xl font-light tracking-tighter text-text-primary uppercase leading-none">
            {t('settings.title')}
          </h1>
        </div>

        {/* mx-auto: SectionWrapper already centers its own max-w-7xl content,
            but this grid's own max-w-4xl was narrower than that with nothing
            centering it inside - it sat flush against the left edge instead
            of in the middle of the page. */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl mx-auto">
          <SectionCard icon={UserIcon} title={t('settings.profile.title')} description={t('settings.profile.desc')} testId="profile-section">
            <form onSubmit={saveProfile} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className={labelClass}>{t('field.firstName')}</label>
                  <input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    disabled={isSavingProfile}
                    className={fieldClass}
                  />
                </div>
                <div className="space-y-2">
                  <label className={labelClass}>{t('field.lastName')}</label>
                  <input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    disabled={isSavingProfile}
                    className={fieldClass}
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={isSavingProfile}
                className="w-full py-3.5 bg-ink text-background-main text-[10px] font-medium uppercase tracking-widest rounded-xl flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50"
              >
                {isSavingProfile ? <Loader2 size={14} className="animate-spin" /> : t('settings.profile.save')}
              </button>
            </form>
          </SectionCard>

          <SectionCard icon={Mail} title={t('settings.email.title')} description={t('settings.email.desc', { email: user?.email ?? '' })} testId="email-section">
            {emailStep === 'form' ? (
              <form onSubmit={requestEmail} className="space-y-4">
                <div className="space-y-2">
                  <label className={labelClass}>{t('settings.email.new')}</label>
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="new@example.com"
                    disabled={isSavingEmail}
                    className={fieldClass}
                  />
                </div>
                <div className="space-y-2">
                  <label className={labelClass}>{t('settings.password.current')}</label>
                  <PasswordInput
                    required
                    value={emailPassword}
                    onChange={(e) => setEmailPassword(e.target.value)}
                    placeholder="••••••••"
                    disabled={isSavingEmail}
                    className={passwordFieldClass}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSavingEmail}
                  className="w-full py-3.5 bg-ink text-background-main text-[10px] font-medium uppercase tracking-widest rounded-xl flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50"
                >
                  {isSavingEmail ? <Loader2 size={14} className="animate-spin" /> : t('settings.sendCode')}
                </button>
              </form>
            ) : (
              <CodeConfirmStep
                targetEmail={user?.email}
                code={emailCode}
                onCodeChange={setEmailCode}
                onConfirm={confirmEmail}
                onResend={() => void doRequestEmail()}
                onCancel={resetEmailCard}
                isBusy={isSavingEmail}
                confirmLabel={t('settings.email.confirm')}
              />
            )}
          </SectionCard>

          <SectionCard icon={Shield} title={t('settings.password.title')} description={t('settings.password.desc')} testId="password-section">
            {passwordStep === 'form' ? (
              <form onSubmit={requestPassword} className="space-y-4">
                <div className="space-y-2">
                  <label className={labelClass}>{t('settings.password.current')}</label>
                  <PasswordInput
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    disabled={isSavingPassword}
                    className={passwordFieldClass}
                  />
                </div>
                <div className="space-y-2">
                  <label className={labelClass}>{t('settings.password.new')}</label>
                  <PasswordInput
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder={t('settings.password.newPlaceholder')}
                    disabled={isSavingPassword}
                    className={passwordFieldClass}
                  />
                </div>
                <div className="space-y-2">
                  <label className={labelClass}>{t('settings.password.confirmNew')}</label>
                  <PasswordInput
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    disabled={isSavingPassword}
                    className={passwordFieldClass}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSavingPassword}
                  className="w-full py-3.5 bg-ink text-background-main text-[10px] font-medium uppercase tracking-widest rounded-xl flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50"
                >
                  {isSavingPassword ? <Loader2 size={14} className="animate-spin" /> : t('settings.sendCode')}
                </button>
              </form>
            ) : (
              <CodeConfirmStep
                targetEmail={user?.email}
                code={passwordCode}
                onCodeChange={setPasswordCode}
                onConfirm={confirmPasswordChange}
                onResend={() => void doRequestPassword()}
                onCancel={resetPasswordCard}
                isBusy={isSavingPassword}
                confirmLabel={t('settings.password.confirm')}
              />
            )}
          </SectionCard>

          <SectionCard icon={SettingsIcon} title={t('settings.account.title')} description={t('settings.account.desc')} testId="account-section">
            <div className="space-y-3 text-[10px] uppercase tracking-widest">
              <div className="flex justify-between">
                <span className="text-text-secondary opacity-50">{t('settings.account.email')}</span>
                <span className="text-text-primary">{user?.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary opacity-50">{t('settings.account.role')}</span>
                <span className="text-text-primary">{user?.role === Role.ROLE_ADMIN ? t('settings.account.roleAdmin') : t('settings.account.roleUser')}</span>
              </div>
              <div className="flex justify-between" data-testid="plan-row">
                <span className="text-text-secondary opacity-50">{t('settings.account.plan')}</span>
                <span className="text-text-primary">
                  {user?.role === Role.ROLE_ADMIN ? t('settings.account.planAdmin') : user?.plan === Plan.PREMIUM ? t('settings.account.planPremium') : t('settings.account.planFree')}
                </span>
              </div>
              {confirmingUpgrade && (
                <p role="status" className="text-text-secondary normal-case tracking-normal text-xs flex items-center gap-2">
                  <Loader2 size={12} className="animate-spin" /> {t('settings.account.confirmingPayment')}
                </p>
              )}
              <BillingActions />
              {/* While payments are off: "Premium is coming soon" + Request Premium (adults only; hides itself otherwise). */}
              <PremiumInterestNote />
              {user?.garmentLimit != null && (
                <div className="flex justify-between items-center gap-6" data-testid="storage-row">
                  <span className="text-text-secondary opacity-50">{t('settings.account.storage')}</span>
                  <StorageMeter className="w-40 text-right" />
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-text-secondary opacity-50">{t('settings.account.since')}</span>
                <span className="text-text-primary">{formatDate(user?.createdAt)}</span>
              </div>
            </div>

            {/* Audit H12: download my data + delete my account and data (replaces the old deactivation). */}
            <AccountDataSection />
          </SectionCard>
        </div>
      </SectionWrapper>
    </div>
  );
};

export default SettingsPage;
