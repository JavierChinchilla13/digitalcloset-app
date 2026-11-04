import api from './axios';
import type { Plan } from '../types';

// Task 103: Premium by Stripe subscription. The server decides everything; these only ask.
export interface BillingStatus {
  // False when payments are not set up on this server: no upgrade buttons are shown.
  enabled: boolean;
  plan: Plan;
  // Stripe's word for the subscription (active, past_due, canceled, ...), null when there is none.
  subscriptionStatus: string | null;
  // ISO date-time the paid period ends, and whether it will not renew.
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  // Whether there is a Stripe customer to open the billing portal for.
  canManage: boolean;
  // "4.99 USD / month", read from the Stripe price; null when unknown.
  priceLabel: string | null;
}

export const billingService = {
  getStatus: async (): Promise<BillingStatus> => {
    const response = await api.get<BillingStatus>('/billing/status');
    return response.data;
  },

  // The Stripe Checkout page to send the browser to.
  startCheckout: async (): Promise<string> => {
    const response = await api.post<{ url: string }>('/billing/checkout');
    return response.data.url;
  },

  // Stripe's customer portal (cancel, update the card, invoices).
  openPortal: async (): Promise<string> => {
    const response = await api.post<{ url: string }>('/billing/portal');
    return response.data.url;
  },
};
