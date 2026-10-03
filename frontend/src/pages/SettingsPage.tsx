import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2, Mail, Settings as SettingsIcon, Shield, Trash2, User as UserIcon } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useToast } from '../components/Toast';
import { userService } from '../api/userService';
import { authService } from '../api/authService';
import SectionWrapper from '../components/SectionWrapper';
import PasswordInput from '../components/PasswordInput';
import { Role } from '../types';

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
}) => (
  <form onSubmit={onConfirm} className="space-y-4">
    <p className="text-text-secondary text-xs leading-relaxed">
      We sent a 6-digit code to <span className="text-text-primary">{targetEmail}</span>. Enter it below to confirm.
    </p>
    <div className="space-y-2">
      <label className={labelClass}>Verification Code</label>
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
        Cancel
      </button>
      <button type="button" onClick={onResend} disabled={isBusy} className="text-accent hover:text-accent-hover transition-colors disabled:opacity-50">
        Resend Code
      </button>
    </div>
  </form>
);

const SettingsPage = () => {
  const { user, login, logout, setToken } = useAuthStore();
  const { showToast } = useToast();
  const navigate = useNavigate();

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
      showToast('Profile updated', 'success');
    } catch (err: any) {
      showToast(err.response?.data?.message || "Couldn't update your profile", 'error');
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
      showToast(`Code sent to ${user?.email}`, 'success');
    } catch (err: any) {
      showToast(err.response?.data?.message || "Couldn't start the email change", 'error');
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
      showToast('Email updated', 'success');
    } catch (err: any) {
      showToast(err.response?.data?.message || "Couldn't confirm the code", 'error');
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
      showToast(`Code sent to ${user?.email}`, 'success');
    } catch (err: any) {
      showToast(err.response?.data?.message || "Couldn't start the password change", 'error');
    } finally {
      setIsSavingPassword(false);
    }
  };

  const requestPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      showToast("New passwords don't match", 'error');
      return;
    }
    void doRequestPassword();
  };

  const confirmPasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingPassword(true);
    try {
      await userService.confirmPasswordChange(passwordCode);
      resetPasswordCard();
      showToast('Password updated', 'success');
    } catch (err: any) {
      showToast(err.response?.data?.message || "Couldn't confirm the code", 'error');
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

  // --- Account / deactivate ---
  const [isConfirmingDeactivate, setIsConfirmingDeactivate] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);

  const deactivate = async () => {
    setIsDeactivating(true);
    try {
      await userService.deactivateMe();
      logout();
      navigate('/login');
    } catch (err: any) {
      showToast(err.response?.data?.message || "Couldn't deactivate your account", 'error');
      setIsDeactivating(false);
    }
  };

  const formatDate = (value?: string) =>
    value ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'unknown';

  return (
    <div className="min-h-dvh bg-background-main pt-24 pb-20">
      <SectionWrapper>
        <div className="space-y-4 mb-10">
          <p className="flex items-center gap-2 text-[10px] font-medium tracking-[0.3em] text-accent uppercase">
            <SettingsIcon size={14} /> Account
          </p>
          <h1 className="text-4xl sm:text-6xl font-light tracking-tighter text-text-primary uppercase leading-none">
            SETTINGS
          </h1>
        </div>

        {/* mx-auto: SectionWrapper already centers its own max-w-7xl content,
            but this grid's own max-w-4xl was narrower than that with nothing
            centering it inside - it sat flush against the left edge instead
            of in the middle of the page. */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl mx-auto">
          <SectionCard icon={UserIcon} title="Profile" description="Your display name" testId="profile-section">
            <form onSubmit={saveProfile} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className={labelClass}>First Name</label>
                  <input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    disabled={isSavingProfile}
                    className={fieldClass}
                  />
                </div>
                <div className="space-y-2">
                  <label className={labelClass}>Last Name</label>
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
                {isSavingProfile ? <Loader2 size={14} className="animate-spin" /> : 'Save Profile'}
              </button>
            </form>
          </SectionCard>

          <SectionCard icon={Mail} title="Email" description={`Currently ${user?.email}`} testId="email-section">
            {emailStep === 'form' ? (
              <form onSubmit={requestEmail} className="space-y-4">
                <div className="space-y-2">
                  <label className={labelClass}>New Email</label>
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
                  <label className={labelClass}>Current Password</label>
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
                  {isSavingEmail ? <Loader2 size={14} className="animate-spin" /> : 'Send Code'}
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
                confirmLabel="Confirm Email Change"
              />
            )}
          </SectionCard>

          <SectionCard icon={Shield} title="Password" description="Change your password" testId="password-section">
            {passwordStep === 'form' ? (
              <form onSubmit={requestPassword} className="space-y-4">
                <div className="space-y-2">
                  <label className={labelClass}>Current Password</label>
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
                  <label className={labelClass}>New Password</label>
                  <PasswordInput
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    disabled={isSavingPassword}
                    className={passwordFieldClass}
                  />
                </div>
                <div className="space-y-2">
                  <label className={labelClass}>Confirm New Password</label>
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
                  {isSavingPassword ? <Loader2 size={14} className="animate-spin" /> : 'Send Code'}
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
                confirmLabel="Confirm Password Change"
              />
            )}
          </SectionCard>

          <SectionCard icon={SettingsIcon} title="Account" description="Account details" testId="account-section">
            <div className="space-y-3 text-[10px] uppercase tracking-widest">
              <div className="flex justify-between">
                <span className="text-text-secondary opacity-50">Email</span>
                <span className="text-text-primary">{user?.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary opacity-50">Role</span>
                <span className="text-text-primary">{user?.role === Role.ROLE_ADMIN ? 'Admin' : 'User'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary opacity-50">Member since</span>
                <span className="text-text-primary">{formatDate(user?.createdAt)}</span>
              </div>
            </div>

            <div className="pt-4 border-t border-ink/5">
              {!isConfirmingDeactivate ? (
                <button
                  onClick={() => setIsConfirmingDeactivate(true)}
                  className="w-full py-3.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[10px] font-medium uppercase tracking-widest rounded-xl flex items-center justify-center gap-2 transition-all"
                >
                  <Trash2 size={14} /> Deactivate My Account
                </button>
              ) : (
                <div className="space-y-3">
                  <p className="text-text-secondary text-[10px] uppercase tracking-widest text-center">
                    This signs you out and deactivates your account. Are you sure?
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setIsConfirmingDeactivate(false)}
                      disabled={isDeactivating}
                      className="py-3 bg-ink/5 hover:bg-ink/10 text-text-secondary hover:text-text-primary text-[10px] font-medium uppercase tracking-widest rounded-xl transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={deactivate}
                      disabled={isDeactivating}
                      className="py-3 bg-red-500 hover:bg-red-600 text-white text-[10px] font-medium uppercase tracking-widest rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-60"
                    >
                      {isDeactivating ? <Loader2 size={14} className="animate-spin" /> : 'Confirm'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </SectionCard>
        </div>
      </SectionWrapper>
    </div>
  );
};

export default SettingsPage;
