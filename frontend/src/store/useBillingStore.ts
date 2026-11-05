import { create } from 'zustand';
import { billingService, type BillingStatus } from '../api/billingService';

// Task 103: the account's billing status, read once and shared by every screen that offers an upgrade
// (the closet-full dialog, Settings). Not persisted: it is cheap to read and must never be stale after
// a payment, so Settings re-reads it when the buyer comes back from Stripe.
interface BillingState {
  status: BillingStatus | null;
  loading: boolean;
  // Reads the status; with `force` even when one is already held. A failure leaves billing "off" (null).
  load: (force?: boolean) => Promise<void>;
  reset: () => void;
}

export const useBillingStore = create<BillingState>((set, get) => ({
  status: null,
  loading: false,

  load: async (force = false) => {
    if (get().loading || (get().status && !force)) return;
    set({ loading: true });
    try {
      set({ status: await billingService.getStatus(), loading: false });
    } catch {
      // Billing is optional: when it cannot be read, no upgrade button is shown.
      set({ status: null, loading: false });
    }
  },

  reset: () => set({ status: null, loading: false }),
}));
