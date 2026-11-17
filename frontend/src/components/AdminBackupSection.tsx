import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clipboard, Download, Loader2, ShieldAlert, Sparkles } from 'lucide-react';
import { backupService, type BackupStatus } from '../api/backupService';
import { useAuthStore } from '../store/useAuthStore';
import { getApiErrorMessage } from '../utils/apiError';
import { estimateStrength, generatePassphrase, isAcceptableArchivePassword } from '../utils/passphrase';
import { useToast } from './Toast';
import GoogleSignInButton from './GoogleSignInButton';
import PasswordInput from './PasswordInput';

// Admin "Backup": status (when the last backup was; a warning at 7 days or none, and a prominent one when the last alert email did not
// go out), the form to download an encrypted copy of the database, and the last 10 downloads. The archive holds every user's email and
// password hash, so the page says so, asks for the admin's own password (or a fresh Google sign-in), and asks for an archive password
// typed twice (or generated) that is sent once and never stored. Nothing typed here is kept after the download or when the page closes.
const WARN_AFTER_DAYS = 7;

const field =
  'w-full min-h-[48px] bg-background-secondary border border-ink/10 rounded-xl py-3 px-4 text-sm text-text-primary focus:outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-accent/60 disabled:opacity-50';
const ghost =
  'min-h-[44px] px-4 py-3 bg-ink/5 hover:bg-ink/10 text-text-primary text-[10px] font-medium uppercase tracking-widest rounded-xl inline-flex items-center justify-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 disabled:opacity-50';

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function formatWhen(value: string): string {
  // The server sends UTC without a zone; show it in the admin's own time.
  const date = new Date(value.endsWith('Z') ? value : `${value}Z`);
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

const STRENGTH_BAR = ['bg-red-400', 'bg-red-400', 'bg-amber-400', 'bg-emerald-400', 'bg-emerald-500'];

const AdminBackupSection = () => {
  const user = useAuthStore((state) => state.user);
  const { showToast } = useToast();
  const googleClientId = String(import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '').trim();
  // Only a confirmed false means "signs in with Google only" (an older copy of the account without the field is treated as having a password).
  const googleOnly = user?.hasPassword === false;

  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [statusFailed, setStatusFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [accountPassword, setAccountPassword] = useState('');
  const [archivePassword, setArchivePassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [saved, setSaved] = useState(false);
  const [generated, setGenerated] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const detailsRef = useRef<HTMLDetailsElement>(null);

  const loadStatus = useCallback(async () => {
    try {
      setStatus(await backupService.getStatus());
      setStatusFailed(false);
    } catch {
      setStatusFailed(true);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads the status when the page opens
    loadStatus();
  }, [loadStatus]);

  // Nothing typed here outlives the page.
  useEffect(
    () => () => {
      setAccountPassword('');
      setArchivePassword('');
      setRepeat('');
    },
    []
  );

  const strength = estimateStrength(archivePassword, accountPassword ? [accountPassword] : []);
  const matches = archivePassword.length > 0 && archivePassword === repeat;
  const acceptable = isAcceptableArchivePassword(archivePassword, accountPassword ? [accountPassword] : []);
  const sameAsAccount = !googleOnly && accountPassword.length > 0 && archivePassword === accountPassword;
  const formReady = acceptable && matches && saved && !sameAsAccount && (googleOnly || accountPassword.length > 0);

  const latest = status?.recent[0];
  const alertFailed = Boolean(latest && !latest.alertSent);
  const days = status?.daysSinceLastBackup;
  const stale = status !== null && (status.lastBackupAt === null || (days ?? 0) >= WARN_AFTER_DAYS);

  const generate = () => {
    const value = generatePassphrase();
    setArchivePassword(value);
    setRepeat(value);
    setGenerated(value);
    setError(null);
  };

  const copyGenerated = async () => {
    if (!generated) return;
    try {
      await navigator.clipboard.writeText(generated);
      showToast('Passphrase copied. Paste it into your password manager now.', 'success');
    } catch {
      showToast("Couldn't copy it. Select the text and copy it by hand.", 'error');
    }
  };

  const run = async (proof: { currentPassword?: string; googleCredential?: string }) => {
    if (!formReady) return;
    setBusy(true);
    setError(null);
    try {
      const blob = await backupService.download({ ...proof, archivePassword });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `vysvi-backup-${new Date().toISOString().slice(0, 10)}.vbk`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      // The password has done its job: forget everything typed.
      setAccountPassword('');
      setArchivePassword('');
      setRepeat('');
      setGenerated(null);
      setSaved(false);
      showToast('Backup downloaded. Keep the file private and keep its password in your password manager.', 'success');
    } catch (err) {
      setError(getApiErrorMessage(err, "Couldn't prepare the backup. Please try again."));
    } finally {
      setBusy(false);
      void loadStatus();
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleOnly) void run({ currentPassword: accountPassword });
  };

  const openSection = () => {
    setOpen(true);
    if (detailsRef.current) detailsRef.current.open = true;
    detailsRef.current?.scrollIntoView?.({ block: 'start' });
    detailsRef.current?.querySelector<HTMLElement>('summary')?.focus();
  };

  return (
    <section aria-labelledby="backup-title" className="mb-10 space-y-4" data-testid="backup-section">
      {/* Status: always visible, so a missing or old backup is noticed without opening anything. */}
      {alertFailed && (
        <div role="alert" className="flex items-start gap-3 rounded-2xl border border-red-500/50 bg-red-500/10 p-4 text-sm text-text-primary">
          <ShieldAlert size={18} className="mt-0.5 shrink-0 text-red-400" aria-hidden />
          <p>
            <strong>Backup alert failed.</strong> The latest backup was downloaded but its alert email could not be sent. If you did not
            make it, change your password now, and check that the mail relay is working.
          </p>
        </div>
      )}
      {status && (
        <div
          role="status"
          className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 text-sm ${
            stale ? 'border-amber-500/50 bg-amber-500/10' : 'border-ink/10 bg-ink/[0.03]'
          }`}
        >
          <p className="flex items-center gap-2 text-text-primary">
            {stale ? <AlertTriangle size={16} className="text-amber-500" aria-hidden /> : <CheckCircle2 size={16} className="text-emerald-500" aria-hidden />}
            {status.lastBackupAt === null
              ? 'No backup has been downloaded yet.'
              : `Last backup ${days === 0 ? 'today' : days === 1 ? '1 day ago' : `${days} days ago`}.`}
            {stale && <span className="text-text-secondary"> It is time to take one.</span>}
          </p>
          <button type="button" onClick={openSection} className={ghost}>
            <Download size={14} aria-hidden /> Back up now
          </button>
        </div>
      )}
      {statusFailed && !status && (
        <p role="status" className="text-xs text-text-secondary">
          Couldn't load the backup status.{' '}
          <button type="button" onClick={() => void loadStatus()} className="underline underline-offset-2 text-text-primary">
            Try again
          </button>
        </p>
      )}

      <details
        ref={detailsRef}
        open={open}
        onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
        className="rounded-2xl border border-ink/10 bg-background-secondary"
      >
        <summary
          id="backup-title"
          className="cursor-pointer list-none flex items-center gap-3 p-5 text-[10px] font-medium uppercase tracking-[0.3em] text-accent min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 rounded-2xl"
        >
          <Download size={14} aria-hidden /> Backup
        </summary>

        <div className="space-y-6 p-5 pt-0">
          <div className="space-y-2 text-sm text-text-secondary leading-relaxed">
            <p className="text-text-primary">
              <strong>This file is a secret.</strong> It holds every user's email and password hash.
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Keep it private: not in a shared folder, not by email, not in a chat.</li>
              <li>Save the archive password in your password manager. The file cannot be opened without it, and nobody can recover it.</li>
              <li>Delete downloaded backups after 90 days.</li>
            </ul>
          </div>

          <form onSubmit={submit} className="space-y-5" aria-label="Download a backup">
            {googleOnly ? (
              <p className="text-xs text-text-secondary">
                Your account signs in with Google, so you confirm it is you with Google at the last step.
              </p>
            ) : (
              <div className="space-y-1">
                <label htmlFor="backup-account-password" className="block text-xs text-text-secondary">
                  My password
                </label>
                <PasswordInput
                  toggleTabbable
                  id="backup-account-password"
                  autoComplete="current-password"
                  value={accountPassword}
                  onChange={(e) => setAccountPassword(e.target.value)}
                  disabled={busy}
                  className={`${field} pr-12`}
                />
              </div>
            )}

            <div className="space-y-1">
              <label htmlFor="backup-archive-password" className="block text-xs text-text-secondary">
                Archive password
              </label>
              <PasswordInput
                toggleTabbable
                id="backup-archive-password"
                autoComplete="new-password"
                value={archivePassword}
                onChange={(e) => {
                  setArchivePassword(e.target.value);
                  setGenerated(null);
                }}
                disabled={busy}
                aria-describedby="backup-strength"
                className={`${field} pr-12`}
              />
              <div id="backup-strength" aria-live="polite" className="pt-2 space-y-1">
                <div className="flex gap-1" aria-hidden>
                  {[1, 2, 3, 4].map((segment) => (
                    <span
                      key={segment}
                      className={`h-1.5 flex-1 rounded-full ${archivePassword && strength.score >= segment ? STRENGTH_BAR[strength.score] : 'bg-ink/10'}`}
                    />
                  ))}
                </div>
                {archivePassword && (
                  <p className="text-xs text-text-secondary">
                    Strength: <strong className="text-text-primary">{strength.label}</strong>
                    {strength.hints.length > 0 && <> - {strength.hints.slice(0, 2).join(' ')}</>}
                  </p>
                )}
                {sameAsAccount && <p className="text-xs text-text-primary">It must be different from your account password.</p>}
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="backup-archive-repeat" className="block text-xs text-text-secondary">
                Repeat the archive password
              </label>
              <PasswordInput
                toggleTabbable
                id="backup-archive-repeat"
                autoComplete="new-password"
                value={repeat}
                onChange={(e) => setRepeat(e.target.value)}
                disabled={busy}
                className={`${field} pr-12`}
              />
              {repeat.length > 0 && !matches && <p className="text-xs text-text-primary pt-1">The two passwords are not the same.</p>}
            </div>

            <div className="space-y-2">
              <button type="button" onClick={generate} disabled={busy} className={ghost}>
                <Sparkles size={14} aria-hidden /> Generate passphrase
              </button>
              {generated && (
                <div className="rounded-xl border border-ink/10 bg-ink/[0.03] p-3 space-y-2">
                  <p className="text-xs text-text-secondary">Copy it into your password manager before you download:</p>
                  <div className="flex flex-wrap items-center gap-3">
                    <code data-testid="generated-passphrase" className="font-mono text-sm text-text-primary break-all select-all">
                      {generated}
                    </code>
                    <button type="button" onClick={copyGenerated} className={ghost}>
                      <Clipboard size={14} aria-hidden /> Copy
                    </button>
                  </div>
                </div>
              )}
            </div>

            <label className="flex items-start gap-3 min-h-[44px] py-2 cursor-pointer">
              <input
                type="checkbox"
                checked={saved}
                onChange={(e) => setSaved(e.target.checked)}
                disabled={busy}
                className="mt-0.5 h-5 w-5 shrink-0 rounded accent-accent cursor-pointer focus-visible:ring-2 focus-visible:ring-accent/60"
              />
              <span className="text-sm text-text-primary leading-snug">I saved the archive password in my password manager.</span>
            </label>

            {error && (
              <p role="alert" className="text-xs text-rose-400">
                {error}
              </p>
            )}

            {googleOnly ? (
              googleClientId ? (
                <div className={formReady && !busy ? '' : 'opacity-50 pointer-events-none'} aria-disabled={!formReady || busy}>
                  <GoogleSignInButton
                    clientId={googleClientId}
                    label="Confirm with Google and download"
                    onCredential={(googleCredential) => void run({ googleCredential })}
                  />
                </div>
              ) : (
                <p role="alert" className="text-xs text-rose-400">
                  Google sign-in is not available right now, so the backup cannot be confirmed from here.
                </p>
              )
            ) : (
              <button
                type="submit"
                disabled={!formReady || busy}
                className="w-full min-h-[48px] py-3 bg-accent text-on-accent text-[10px] font-medium uppercase tracking-widest rounded-xl inline-flex items-center justify-center gap-2 transition-[transform,opacity] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 disabled:opacity-50"
              >
                {busy ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Download size={14} aria-hidden />}
                {busy ? 'Preparing the backup...' : 'Download backup'}
              </button>
            )}
            {busy && (
              <p role="status" className="text-xs text-text-secondary">
                Building the encrypted file. This can take a minute for a large database.
              </p>
            )}
          </form>

          <div className="space-y-2">
            <h3 className="text-[10px] font-medium uppercase tracking-[0.3em] text-accent">Last downloads</h3>
            {status && status.recent.length > 0 ? (
              <ul className="divide-y divide-ink/5 text-sm" data-testid="backup-history">
                {status.recent.map((item, index) => (
                  <li key={`${item.downloadedAt}-${index}`} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2">
                    <span className="text-text-primary">{formatWhen(item.downloadedAt)}</span>
                    <span className="text-text-secondary">
                      {item.ok ? formatSize(item.bytes) : 'Did not finish'}
                      {' - '}
                      {item.alertSent ? 'alert email sent' : <strong className="text-text-primary">alert email NOT sent</strong>}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-text-secondary">No downloads yet.</p>
            )}
          </div>
        </div>
      </details>
    </section>
  );
};

export default AdminBackupSection;
