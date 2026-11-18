import api from './axios';

// "Request Premium" while payments are switched off (PremiumInterestController): one request per account, idempotent; the admin gets only a count.
export interface PremiumInterestState {
  requested: boolean;
  // ISO date-time of the request, null until there is one.
  requestedAt: string | null;
}

export interface PremiumInterestSummary {
  count: number;
  latestAt: string | null;
}

export const premiumInterestService = {
  getState: async (): Promise<PremiumInterestState> => {
    const response = await api.get<PremiumInterestState>('/billing/premium-interest');
    return response.data;
  },

  // Asking again answers "requested" again (it is not an error).
  request: async (): Promise<PremiumInterestState> => {
    const response = await api.post<PremiumInterestState>('/billing/premium-interest');
    return response.data;
  },

  // Admin only: how many requests, and when the latest was. No account is identified.
  getAdminSummary: async (): Promise<PremiumInterestSummary> => {
    const response = await api.get<PremiumInterestSummary>('/admin/premium-interest');
    return response.data;
  },
};
