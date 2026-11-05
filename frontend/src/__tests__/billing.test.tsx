import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import BillingActions from '../components/BillingActions';
import StorageLimitModal from '../components/StorageLimitModal';
import SettingsPage from '../pages/SettingsPage';
import { ToastProvider } from '../components/Toast';
import { useAuthStore } from '../store/useAuthStore';
import { useBillingStore } from '../store/useBillingStore';
import { useClothingStore } from '../store/useClothingStore';
import { billingService, type BillingStatus } from '../api/billingService';
import { authService } from '../api/authService';
import { Plan, Role } from '../types';
import { makeItems, makeUser } from '../test/fixtures';

// Task 103: the Premium call to action, the closet-full dialog's way out, and the return from Stripe.
vi.mock('../api/billingService', () => ({
  billingService: { getStatus: vi.fn(), startCheckout: vi.fn(), openPortal: vi.fn() },
}));
vi.mock('../api/authService', () => ({
  authService: { getCurrentUser: vi.fn(), login: vi.fn(), register: vi.fn() },
}));

const billing = vi.mocked(billingService);
const auth = vi.mocked(authService);

const STATUS: BillingStatus = {
  enabled: true,
  plan: Plan.FREE,
  subscriptionStatus: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  canManage: false,
  priceLabel: '4.99 USD / month',
};

const assign = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  useBillingStore.getState().reset();
  useAuthStore.getState().login('token', makeUser());
  billing.getStatus.mockResolvedValue({ ...STATUS });
  Object.defineProperty(window, 'location', {
    value: { ...window.location, assign, origin: 'http://localhost' },
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  vi.useRealTimers();
});

const renderActions = () =>
  render(
    <MemoryRouter>
      <BillingActions />
    </MemoryRouter>
  );

describe('the Premium call to action', () => {
  it('a free account sees the upgrade button with the price, and it goes to Stripe Checkout', async () => {
    billing.startCheckout.mockResolvedValue('https://checkout.stripe.test/abc');
    const user = userEvent.setup();
    renderActions();

    const button = await screen.findByRole('button', { name: /upgrade to premium - 4\.99 usd \/ month/i });
    await user.click(button);

    expect(billing.startCheckout).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith('https://checkout.stripe.test/abc');
  });

  it('shows nothing when payments are not set up on the server', async () => {
    billing.getStatus.mockResolvedValue({ ...STATUS, enabled: false });
    renderActions();

    await waitFor(() => expect(billing.getStatus).toHaveBeenCalled());
    expect(screen.queryByTestId('billing-actions')).not.toBeInTheDocument();
  });

  it('shows nothing when the status cannot be read', async () => {
    billing.getStatus.mockRejectedValue(new Error('offline'));
    renderActions();

    await waitFor(() => expect(billing.getStatus).toHaveBeenCalled());
    expect(screen.queryByTestId('billing-actions')).not.toBeInTheDocument();
  });

  it('shows nothing for an admin', async () => {
    useAuthStore.getState().login('token', makeUser({ role: Role.ROLE_ADMIN, garmentLimit: null }));
    renderActions();

    await waitFor(() => expect(billing.getStatus).toHaveBeenCalled());
    expect(screen.queryByTestId('billing-actions')).not.toBeInTheDocument();
  });

  it('a subscriber sees Manage billing and the end date when it will not renew', async () => {
    useAuthStore.getState().login('token', makeUser({ plan: Plan.PREMIUM, garmentLimit: 300 }));
    billing.getStatus.mockResolvedValue({
      ...STATUS,
      plan: Plan.PREMIUM,
      subscriptionStatus: 'active',
      canManage: true,
      cancelAtPeriodEnd: true,
      currentPeriodEnd: '2030-01-15T12:00:00',
    });
    billing.openPortal.mockResolvedValue('https://billing.stripe.test/portal');
    const user = userEvent.setup();
    renderActions();

    expect(await screen.findByText(/premium ends on january 15, 2030 and will not renew/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /upgrade/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /manage billing/i }));
    expect(assign).toHaveBeenCalledWith('https://billing.stripe.test/portal');
  });

  it('warns when the last payment failed', async () => {
    useAuthStore.getState().login('token', makeUser({ plan: Plan.PREMIUM, garmentLimit: 300 }));
    billing.getStatus.mockResolvedValue({ ...STATUS, plan: Plan.PREMIUM, subscriptionStatus: 'past_due', canManage: true });
    renderActions();

    expect(await screen.findByText(/last payment failed/i)).toBeInTheDocument();
  });

  it('says so when the checkout cannot be opened, and stays on the page', async () => {
    billing.startCheckout.mockRejectedValue({ response: { status: 400, data: { message: 'Payments are not set up yet.' } } });
    const user = userEvent.setup();
    renderActions();

    await user.click(await screen.findByRole('button', { name: /upgrade to premium/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/not set up/i);
    expect(assign).not.toHaveBeenCalled();
  });
});

describe('the closet-full dialog', () => {
  beforeEach(() => {
    useClothingStore.setState({ items: makeItems(15) });
  });

  it('offers the upgrade when payments are set up', async () => {
    render(
      <ToastProvider>
        <StorageLimitModal isOpen onClose={() => {}} />
      </ToastProvider>
    );

    expect(await screen.findByRole('button', { name: /upgrade to premium/i })).toBeInTheDocument();
    expect(screen.queryByText(/coming soon/i)).not.toBeInTheDocument();
  });

  it('says more space is planned when payments are not set up', async () => {
    billing.getStatus.mockResolvedValue({ ...STATUS, enabled: false });
    render(
      <ToastProvider>
        <StorageLimitModal isOpen onClose={() => {}} />
      </ToastProvider>
    );

    expect(await screen.findByText(/more space are coming soon/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /upgrade/i })).not.toBeInTheDocument();
  });
});

describe('coming back from Stripe', () => {
  const renderSettings = () =>
    render(
      <MemoryRouter initialEntries={['/settings?billing=success']}>
        <ToastProvider>
          <SettingsPage />
        </ToastProvider>
      </MemoryRouter>
    );

  it('waits for the webhook, then shows Premium', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const premium = makeUser({ plan: Plan.PREMIUM, garmentLimit: 300 });
    // The first read is before Stripe's webhook arrived, the second after.
    auth.getCurrentUser.mockResolvedValueOnce(makeUser()).mockResolvedValue(premium);
    renderSettings();

    expect(await screen.findByText(/confirming your payment/i)).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3500);
    });

    await waitFor(() => expect(useAuthStore.getState().user?.plan).toBe(Plan.PREMIUM));
    expect(await screen.findByText(/welcome to premium/i)).toBeInTheDocument();
    expect(screen.queryByText(/confirming your payment/i)).not.toBeInTheDocument();
    expect(auth.getCurrentUser).toHaveBeenCalledTimes(2);
  });

  it('does not trust the address alone: a free account stays free until the server says Premium', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    auth.getCurrentUser.mockResolvedValue(makeUser());
    renderSettings();

    await screen.findByText(/confirming your payment/i);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });

    expect(useAuthStore.getState().user?.plan).toBe(Plan.FREE);
    expect(screen.queryByText(/welcome to premium/i)).not.toBeInTheDocument();
  });
});
