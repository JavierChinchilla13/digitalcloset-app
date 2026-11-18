import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import PremiumInterestNote from '../components/PremiumInterestNote';
import AdminPremiumInterest from '../components/AdminPremiumInterest';
import StorageLimitModal from '../components/StorageLimitModal';
import { ToastProvider } from '../components/Toast';
import { useAuthStore } from '../store/useAuthStore';
import { useBillingStore } from '../store/useBillingStore';
import { useClothingStore } from '../store/useClothingStore';
import { billingService, type BillingStatus } from '../api/billingService';
import { premiumInterestService } from '../api/premiumInterestService';
import { Plan, Role } from '../types';
import { makeItems, makeUser } from '../test/fixtures';

// "Premium is coming soon / Request Premium": shown only while payments are off and only to a declared adult with confirmed details; the
// three button states; the closet-full dialog; the admin count (a number, no names).
vi.mock('../api/billingService', () => ({
  billingService: { getStatus: vi.fn(), startCheckout: vi.fn(), openPortal: vi.fn() },
}));
vi.mock('../api/premiumInterestService', () => ({
  premiumInterestService: { getState: vi.fn(), request: vi.fn(), getAdminSummary: vi.fn() },
}));

const billing = vi.mocked(billingService);
const interest = vi.mocked(premiumInterestService);

const OFF: BillingStatus = {
  enabled: false, plan: Plan.FREE, subscriptionStatus: null, currentPeriodEnd: null, cancelAtPeriodEnd: false, canManage: false, priceLabel: null,
};
const ON: BillingStatus = { ...OFF, enabled: true, priceLabel: '4.99 USD / month' };

const NOTE = /premium is coming soon\. want it\? let us know\./i;
const requestButton = () => screen.getByRole('button', { name: /request premium/i });

function renderNote() {
  return render(
    <ToastProvider>
      <PremiumInterestNote />
    </ToastProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  useBillingStore.getState().reset();
  useAuthStore.getState().login('t', makeUser());
  billing.getStatus.mockResolvedValue({ ...OFF });
  interest.getState.mockResolvedValue({ requested: false, requestedAt: null });
});

describe('who sees it', () => {
  it('a declared adult with confirmed details, while payments are off', async () => {
    renderNote();
    expect(await screen.findByText(NOTE)).toBeInTheDocument();
    expect(requestButton()).toBeEnabled();
  });

  it('nobody, once payments are set up (the normal Upgrade flow takes over)', async () => {
    billing.getStatus.mockResolvedValue({ ...ON });
    renderNote();
    await waitFor(() => expect(billing.getStatus).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByText(NOTE)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /request premium/i })).not.toBeInTheDocument();
    expect(interest.getState).not.toHaveBeenCalled();
  });

  it('nothing is shown (and nothing is asked) while the billing status is still loading', () => {
    billing.getStatus.mockReturnValue(new Promise(() => {}));
    renderNote();
    expect(screen.queryByText(NOTE)).not.toBeInTheDocument();
    expect(interest.getState).not.toHaveBeenCalled();
  });

  it.each([
    ['a declared minor (13-17)', { ageBand: 'MINOR' as const }],
    ['an account that has not confirmed its details', { ageBand: null, needsLegalConfirmation: true }],
    ['an adult whose details still need confirming', { ageBand: 'ADULT' as const, needsLegalConfirmation: true }],
    ['an admin', { role: Role.ROLE_ADMIN, garmentLimit: null }],
    ['an account that already has Premium', { plan: Plan.PREMIUM, garmentLimit: 300 }],
  ])('not %s', async (_name, overrides) => {
    useAuthStore.getState().login('t', makeUser(overrides));
    renderNote();
    await waitFor(() => expect(billing.getStatus).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByText(NOTE)).not.toBeInTheDocument();
    expect(interest.getState).not.toHaveBeenCalled();
  });

  it('does not promise a price, a date or a feature', async () => {
    renderNote();
    const note = await screen.findByTestId('premium-interest');
    expect(note.textContent).not.toMatch(/\$|usd|price|\/month|\d{4}|unlimited|garments/i);
    expect((note.textContent ?? '').replace(/\s+/g, ' ').trim()).toBe('Premium is coming soon. Want it? Let us know. Request Premium');
  });
});

describe('the button', () => {
  it('goes idle -> sending -> Requested (disabled) with a thank-you in a live region', async () => {
    let finish: (v: { requested: boolean; requestedAt: string }) => void = () => {};
    interest.request.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const user = userEvent.setup();
    renderNote();
    await screen.findByText(NOTE);

    await user.click(requestButton());
    expect(screen.getByRole('button', { name: /sending/i })).toBeDisabled();

    finish({ requested: true, requestedAt: '2026-11-18T10:00:00' });
    const done = await screen.findByRole('button', { name: /requested/i });
    expect(done).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent("Thanks, we'll let you know.");
    expect(interest.request).toHaveBeenCalledTimes(1);
  });

  it('already requested (reload, or another device): shows Requested straight away, no second request possible', async () => {
    interest.getState.mockResolvedValue({ requested: true, requestedAt: '2026-11-17T10:00:00' });
    renderNote();
    expect(await screen.findByRole('button', { name: /requested/i })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent("Thanks, we'll let you know.");
    expect(interest.request).not.toHaveBeenCalled();
  });

  it('says what went wrong, and the button stays usable to try again', async () => {
    interest.request.mockRejectedValueOnce({ response: { status: 400, data: { message: 'Something broke' } } });
    interest.request.mockResolvedValueOnce({ requested: true, requestedAt: '2026-11-18T10:00:00' });
    const user = userEvent.setup();
    renderNote();
    await screen.findByText(NOTE);

    await user.click(requestButton());
    expect(await screen.findByRole('alert')).toHaveTextContent('Something broke');
    expect(requestButton()).toBeEnabled();

    await user.click(requestButton());
    expect(await screen.findByRole('button', { name: /requested/i })).toBeDisabled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('works from the keyboard alone: focus the button, press Enter', async () => {
    interest.request.mockResolvedValue({ requested: true, requestedAt: '2026-11-18T10:00:00' });
    const user = userEvent.setup();
    renderNote();
    await screen.findByText(NOTE);

    await user.tab();
    expect(requestButton()).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('button', { name: /requested/i })).toBeDisabled();
  });
});

describe('the closet-full dialog', () => {
  beforeEach(() => {
    useClothingStore.setState({ items: makeItems(15) });
  });

  const renderModal = () =>
    render(
      <ToastProvider>
        <StorageLimitModal isOpen onClose={() => {}} />
      </ToastProvider>
    );

  it('an adult sees the Premium request instead of "plans are coming soon" while payments are off', async () => {
    renderModal();
    expect(await screen.findByText(NOTE)).toBeInTheDocument();
    expect(screen.queryByText(/more space are coming soon/i)).not.toBeInTheDocument();
  });

  it('a minor keeps the old sentence and gets no request button', async () => {
    useAuthStore.getState().login('t', makeUser({ ageBand: 'MINOR' }));
    renderModal();
    expect(await screen.findByText(/more space are coming soon/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /request premium/i })).not.toBeInTheDocument();
  });

  it('with payments set up it shows the normal Upgrade button and no request', async () => {
    billing.getStatus.mockResolvedValue({ ...ON });
    renderModal();
    expect(await screen.findByRole('button', { name: /upgrade to premium/i })).toBeInTheDocument();
    expect(screen.queryByText(NOTE)).not.toBeInTheDocument();
  });
});

describe('the admin count', () => {
  it('shows the number and the date of the latest request, and nothing that names anyone', async () => {
    interest.getAdminSummary.mockResolvedValue({ count: 12, latestAt: '2026-11-17T09:30:00' });
    const { container } = render(<AdminPremiumInterest />);
    const line = await screen.findByTestId('premium-interest-count');
    expect(line).toHaveTextContent('Premium requests: 12');
    expect(line).toHaveTextContent(/latest Nov 17, 2026/);
    expect(container.textContent).not.toMatch(/@/);
  });

  it('shows 0 with no date when there is none, and nothing at all if it cannot be loaded', async () => {
    interest.getAdminSummary.mockResolvedValueOnce({ count: 0, latestAt: null });
    const first = render(<AdminPremiumInterest />);
    expect(await screen.findByTestId('premium-interest-count')).toHaveTextContent(/^Premium requests: 0$/);
    first.unmount();

    interest.getAdminSummary.mockRejectedValueOnce(new Error('no'));
    const second = render(<AdminPremiumInterest />);
    await waitFor(() => expect(interest.getAdminSummary).toHaveBeenCalledTimes(2));
    expect(second.container).toBeEmptyDOMElement();
  });
});
