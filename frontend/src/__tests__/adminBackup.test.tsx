import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import AdminBackupSection from '../components/AdminBackupSection';
import { ToastProvider } from '../components/Toast';
import { useAuthStore } from '../store/useAuthStore';
import { backupService, type BackupStatus } from '../api/backupService';
import { makeUser } from '../test/fixtures';
import { Role } from '../types';

// The admin "Backup" section: status and warnings, the form that stays shut until everything is right, the download, and the errors.
vi.mock('../api/backupService', () => ({
  backupService: { getStatus: vi.fn(), download: vi.fn() },
}));
// Google's own button is replaced by one that hands over a fake credential (jsdom has no Google script).
vi.mock('../components/GoogleSignInButton', () => ({
  default: ({ onCredential, label }: { onCredential: (c: string) => void; label?: string }) => (
    <button type="button" onClick={() => onCredential('fresh-google-credential')}>{label}</button>
  ),
}));

const service = vi.mocked(backupService);
const ARCHIVE_PASSWORD = 'a long archive passphrase 42';

const NEVER: BackupStatus = { lastBackupAt: null, daysSinceLastBackup: null, recent: [] };
const recent = (days: number, alertSent = true): BackupStatus => ({
  lastBackupAt: '2026-11-10T10:00:00',
  daysSinceLastBackup: days,
  recent: [{ downloadedAt: '2026-11-10T10:00:00', bytes: 2_500_000, ok: true, alertSent, adminUserId: 1 }],
});

function renderSection() {
  return render(
    <ToastProvider>
      <AdminBackupSection />
    </ToastProvider>
  );
}

async function openSection(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByText('Backup', { selector: 'summary' }));
}

async function fillForm(user: ReturnType<typeof userEvent.setup>, opts: { archive?: string; repeat?: string; saved?: boolean; account?: string } = {}) {
  const { archive = ARCHIVE_PASSWORD, repeat = archive, saved = true, account = 'Admin-account-pw-1' } = opts;
  await openSection(user);
  if (account) await user.type(screen.getByLabelText('My password'), account);
  await user.type(screen.getByLabelText('Archive password'), archive);
  await user.type(screen.getByLabelText('Repeat the archive password'), repeat);
  if (saved) await user.click(screen.getByLabelText(/i saved the archive password/i));
}

const downloadButton = () => screen.getByRole('button', { name: /^download backup$/i });

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.getState().login('t', makeUser({ role: Role.ROLE_ADMIN, hasPassword: true }));
  service.getStatus.mockResolvedValue(NEVER);
  Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:backup'), revokeObjectURL: vi.fn() });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});

describe('status and warnings', () => {
  it('says so, as a warning, when there has never been a backup', async () => {
    renderSection();
    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent('No backup has been downloaded yet.');
    expect(status).toHaveTextContent(/time to take one/i);
  });

  it('shows "Last backup N days ago" without a warning under 7 days', async () => {
    service.getStatus.mockResolvedValue(recent(3));
    renderSection();
    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent('Last backup 3 days ago.');
    expect(status).not.toHaveTextContent(/time to take one/i);
  });

  it('warns at 7 days or more, and says "today" and "1 day ago" in their own words', async () => {
    service.getStatus.mockResolvedValue(recent(7));
    const first = renderSection();
    expect(await screen.findByRole('status')).toHaveTextContent(/Last backup 7 days ago\..*time to take one/i);
    first.unmount();

    service.getStatus.mockResolvedValue(recent(0));
    const second = renderSection();
    expect(await screen.findByRole('status')).toHaveTextContent('Last backup today.');
    second.unmount();

    service.getStatus.mockResolvedValue(recent(1));
    renderSection();
    expect(await screen.findByRole('status')).toHaveTextContent('Last backup 1 day ago.');
  });

  it('shows a prominent alert when the latest download had alert_sent = false, and none when it did', async () => {
    service.getStatus.mockResolvedValue(recent(1, false));
    const first = renderSection();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/backup alert failed/i);
    expect(alert).toHaveTextContent(/change your password/i);
    first.unmount();

    service.getStatus.mockResolvedValue(recent(1, true));
    renderSection();
    await screen.findByRole('status');
    expect(screen.queryByText(/backup alert failed/i)).not.toBeInTheDocument();
  });

  it('lists the last downloads with their size and whether the alert email went out', async () => {
    service.getStatus.mockResolvedValue({
      lastBackupAt: '2026-11-10T10:00:00',
      daysSinceLastBackup: 2,
      recent: [
        { downloadedAt: '2026-11-10T10:00:00', bytes: 2_500_000, ok: true, alertSent: false, adminUserId: 1 },
        { downloadedAt: '2026-11-09T10:00:00', bytes: 0, ok: false, alertSent: true, adminUserId: 1 },
        { downloadedAt: '2026-11-08T10:00:00', bytes: 900, ok: true, alertSent: true, adminUserId: 1 },
      ],
    });
    const user = userEvent.setup();
    renderSection();
    await screen.findByRole('status');
    await openSection(user);

    const rows = within(screen.getByTestId('backup-history')).getAllByRole('listitem');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('2.4 MB');
    expect(rows[0]).toHaveTextContent('alert email NOT sent');
    expect(rows[1]).toHaveTextContent('Did not finish');
    expect(rows[2]).toHaveTextContent('1 KB');
    expect(rows[2]).toHaveTextContent('alert email sent');
  });

  it('"Back up now" opens the section', async () => {
    const user = userEvent.setup();
    renderSection();
    await screen.findByRole('status');
    const summary = screen.getByText('Backup', { selector: 'summary' });
    expect(summary.closest('details')).not.toHaveAttribute('open');

    await user.click(screen.getByRole('button', { name: /back up now/i }));
    expect(summary.closest('details')).toHaveAttribute('open');
  });
});

describe('what the section tells the admin', () => {
  it('says it is a secret, to keep it private, to save the password in a password manager, that it cannot be opened without it, and to delete after 90 days', async () => {
    const user = userEvent.setup();
    renderSection();
    await openSection(user);
    const text = document.body.textContent ?? '';
    expect(text).toMatch(/this file is a secret/i);
    expect(text).toMatch(/every user's email and password hash/i);
    expect(text).toMatch(/not in a shared folder, not by email, not in a chat/i);
    expect(text).toMatch(/password manager/i);
    expect(text).toMatch(/cannot be opened without it/i);
    expect(text).toMatch(/delete downloaded backups after 90 days/i);
  });
});

describe('the form', () => {
  it('stays shut until the account password, a strong enough archive password typed twice, and the checkbox are all there', async () => {
    const user = userEvent.setup();
    renderSection();
    await openSection(user);
    expect(downloadButton()).toBeDisabled();

    await user.type(screen.getByLabelText('My password'), 'Admin-account-pw-1');
    expect(downloadButton()).toBeDisabled();
    await user.type(screen.getByLabelText('Archive password'), ARCHIVE_PASSWORD);
    expect(downloadButton()).toBeDisabled();            // not repeated, not ticked
    await user.type(screen.getByLabelText('Repeat the archive password'), ARCHIVE_PASSWORD);
    expect(downloadButton()).toBeDisabled();            // not ticked
    await user.click(screen.getByLabelText(/i saved the archive password/i));
    expect(downloadButton()).toBeEnabled();
  });

  it('refuses a weak archive password (and says why), and one that does not match its repeat', async () => {
    const user = userEvent.setup();
    renderSection();
    await fillForm(user, { archive: 'password1234', repeat: 'password1234' });
    expect(downloadButton()).toBeDisabled();
    expect(screen.getByText(/Strength:/)).toHaveTextContent(/weak/i);
    expect(screen.getByText(/Strength:/)).toHaveTextContent(/common words/i);

    await user.clear(screen.getByLabelText('Repeat the archive password'));
    await user.type(screen.getByLabelText('Repeat the archive password'), 'something else');
    expect(screen.getByText(/the two passwords are not the same/i)).toBeInTheDocument();
  });

  it('refuses an archive password that is the account password', async () => {
    const user = userEvent.setup();
    renderSection();
    await fillForm(user, { account: ARCHIVE_PASSWORD, archive: ARCHIVE_PASSWORD });
    expect(downloadButton()).toBeDisabled();
    expect(screen.getByText(/must be different from your account password/i)).toBeInTheDocument();
  });

  it('has a Show/Hide toggle on each password field', async () => {
    const user = userEvent.setup();
    renderSection();
    await openSection(user);
    expect(screen.getAllByRole('button', { name: /show password/i })).toHaveLength(3);
    await user.click(screen.getAllByRole('button', { name: /show password/i })[1]);
    expect(screen.getByLabelText('Archive password')).toHaveAttribute('type', 'text');
  });

  it('"Generate passphrase" fills both fields with a strong one and shows it to copy', async () => {
    const user = userEvent.setup();
    renderSection();
    await openSection(user);
    await user.click(screen.getByRole('button', { name: /generate passphrase/i }));

    const shown = screen.getByTestId('generated-passphrase').textContent ?? '';
    expect(shown).toMatch(/^[a-z2-9]{4}(-[a-z2-9]{4}){5}$/);
    expect(screen.getByLabelText('Archive password')).toHaveValue(shown);
    expect(screen.getByLabelText('Repeat the archive password')).toHaveValue(shown);
    expect(screen.getByText(/Strength:/)).toHaveTextContent(/strong/i);
  });

  it('Copy puts the generated passphrase on the clipboard', async () => {
    const user = userEvent.setup();
    renderSection();
    await openSection(user);
    await user.click(screen.getByRole('button', { name: /generate passphrase/i }));
    const shown = screen.getByTestId('generated-passphrase').textContent ?? '';
    // user-event installs its own clipboard; read it back.
    await user.click(screen.getByRole('button', { name: /^copy$/i }));
    expect(await navigator.clipboard.readText()).toBe(shown);
  });
});

describe('downloading', () => {
  it('sends the account password and the archive password, saves the file, forgets what was typed, and refreshes the status', async () => {
    service.download.mockResolvedValue(new Blob(['x']));
    service.getStatus.mockResolvedValueOnce(NEVER).mockResolvedValue(recent(0));
    const user = userEvent.setup();
    renderSection();
    await fillForm(user);

    await user.click(downloadButton());

    await waitFor(() => expect(service.download).toHaveBeenCalledWith({ currentPassword: 'Admin-account-pw-1', archivePassword: ARCHIVE_PASSWORD }));
    expect(URL.createObjectURL).toHaveBeenCalled();
    await waitFor(() => expect(screen.getByLabelText('Archive password')).toHaveValue(''));
    expect(screen.getByLabelText('My password')).toHaveValue('');
    expect(screen.getByLabelText('Repeat the archive password')).toHaveValue('');
    expect(screen.getByLabelText(/i saved the archive password/i)).not.toBeChecked();
    expect(await screen.findByText('Last backup today.')).toBeInTheDocument();
  });

  it("shows the server's reason (wrong password, too many attempts, too large) and keeps the form", async () => {
    const user = userEvent.setup();
    renderSection();
    await fillForm(user);

    for (const message of ['Current password is incorrect', 'Too many backup attempts. Please try again later.', 'The backup is larger than the 200 MB limit.']) {
      service.download.mockRejectedValueOnce({ response: { status: 403, data: { message } } });
      await user.click(downloadButton());
      expect(await screen.findByRole('alert')).toHaveTextContent(message);
    }
    expect(screen.getByLabelText('Archive password')).toHaveValue(ARCHIVE_PASSWORD);
  });

  it('while the file is built it says so and cannot be pressed twice', async () => {
    let finish: (b: Blob) => void = () => {};
    service.download.mockReturnValue(new Promise<Blob>((resolve) => { finish = resolve; }));
    const user = userEvent.setup();
    renderSection();
    await fillForm(user);

    await user.click(downloadButton());
    expect(await screen.findByText(/building the encrypted file/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /preparing the backup/i })).toBeDisabled();
    finish(new Blob(['x']));
    await waitFor(() => expect(screen.queryByText(/building the encrypted file/i)).not.toBeInTheDocument());
    expect(service.download).toHaveBeenCalledTimes(1);
  });

  it('is reachable and usable with the keyboard alone', async () => {
    service.download.mockResolvedValue(new Blob(['x']));
    const user = userEvent.setup();
    renderSection();
    await screen.findByRole('status');

    // (Enter or Space on the summary opens it in a real browser; jsdom does not do that, so open it with a click, then use only the keyboard.)
    await user.click(screen.getByText('Backup', { selector: 'summary' }));
    await user.tab();                                      // My password
    expect(screen.getByLabelText('My password')).toHaveFocus();
    await user.keyboard('Admin-account-pw-1');
    await user.tab();                                      // its Show/Hide button
    expect(screen.getAllByRole('button', { name: /show password/i })[0]).toHaveFocus();
    await user.keyboard('{Enter}');                        // reveal it from the keyboard
    expect(screen.getByLabelText('My password')).toHaveAttribute('type', 'text');
    await user.tab();
    expect(screen.getByLabelText('Archive password')).toHaveFocus();
    await user.keyboard(ARCHIVE_PASSWORD);
    await user.tab();                                      // its Show/Hide button
    await user.tab();
    expect(screen.getByLabelText('Repeat the archive password')).toHaveFocus();
    await user.keyboard(ARCHIVE_PASSWORD);
    await user.tab();                                      // its Show/Hide button
    await user.tab();
    expect(screen.getByRole('button', { name: /generate passphrase/i })).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText(/i saved the archive password/i)).toHaveFocus();
    await user.keyboard(' ');
    await user.tab();
    expect(downloadButton()).toHaveFocus();
    await user.keyboard('{Enter}');
    await waitFor(() => expect(service.download).toHaveBeenCalledTimes(1));
  });
});

describe('an admin who signs in with Google only', () => {
  beforeEach(() => {
    useAuthStore.getState().login('t', makeUser({ role: Role.ROLE_ADMIN, hasPassword: false }));
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-client.apps.googleusercontent.com');
  });

  it('has no password field; Google confirms it at the last step, and only once the rest is filled in', async () => {
    service.download.mockResolvedValue(new Blob(['x']));
    const user = userEvent.setup();
    renderSection();
    await openSection(user);
    expect(screen.queryByLabelText('My password')).not.toBeInTheDocument();
    expect(document.querySelector('script[src*="accounts.google.com"]')).toBeNull();

    await user.type(screen.getByLabelText('Archive password'), ARCHIVE_PASSWORD);
    await user.type(screen.getByLabelText('Repeat the archive password'), ARCHIVE_PASSWORD);
    await user.click(screen.getByLabelText(/i saved the archive password/i));
    await user.click(screen.getByRole('button', { name: /confirm with google and download/i }));

    await waitFor(() => expect(service.download).toHaveBeenCalledWith({ googleCredential: 'fresh-google-credential', archivePassword: ARCHIVE_PASSWORD }));
    vi.unstubAllEnvs();
  });

  it('does nothing from the Google button while the form is incomplete', async () => {
    const user = userEvent.setup();
    renderSection();
    await openSection(user);
    await user.click(screen.getByRole('button', { name: /confirm with google and download/i }));
    expect(service.download).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });
});
