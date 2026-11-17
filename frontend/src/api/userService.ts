import api from './axios';
import type { AuthResponse, User } from '../types';
import type { AgeConsentPayload } from '../hooks/useAgeConsentForm';

// The signed-in user's own account endpoints (UserController /api/users/me).
// Task 78: the "main outfit" lives on the account, so it follows the user
// across devices instead of living in one browser's storage.
export const userService = {
  getMe: async (): Promise<User> => {
    const response = await api.get<User>('/users/me');
    return response.data;
  },

  setMainOutfit: async (outfitId: number): Promise<User> => {
    const response = await api.put<User>('/users/me/main-outfit', { outfitId });
    return response.data;
  },

  // Task 79 (Settings page):
  updateProfile: async (data: { firstName?: string; lastName?: string }): Promise<User> => {
    const response = await api.put<User>('/users/me', data);
    return response.data;
  },

  // Task 79 follow-up: changing either requires confirming a 6-digit code
  // emailed to the account's current address - request stages the change,
  // confirm applies it. Both confirms return a fresh token: email is the login
  // identifier, so the old token's subject stops resolving the instant it's
  // applied; and a password change signs every older token out (audit H1), the
  // caller's own included, so the caller carries on with the new one.
  requestPasswordChange: async (currentPassword: string, newPassword: string): Promise<void> => {
    await api.post('/users/me/password/request', { currentPassword, newPassword });
  },

  confirmPasswordChange: async (code: string): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/users/me/password/confirm', { code });
    return response.data;
  },

  requestEmailChange: async (newEmail: string, currentPassword: string): Promise<void> => {
    await api.post('/users/me/email/request', { newEmail, currentPassword });
  },

  confirmEmailChange: async (code: string): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/users/me/email/confirm', { code });
    return response.data;
  },

  // Audit H12: an account made before the age step records its facts. Under 13 the server erases the account and answers 403 AGE_NOT_ALLOWED.
  confirmLegal: async (data: AgeConsentPayload): Promise<User> => {
    const response = await api.post<User>('/users/me/legal', data);
    return response.data;
  },

  // Audit H12: deletes the account and its data for good. Proof is the password, or a fresh Google credential for a Google-only account.
  deleteAccount: async (proof: { password?: string; googleCredential?: string }): Promise<void> => {
    await api.post('/users/me/delete', { confirmation: 'DELETE', ...proof });
  },

  // Audit H12: "download my data" (JSON file of everything held about the account).
  exportMyData: async (): Promise<Blob> => {
    const response = await api.get<Blob>('/users/me/export', { responseType: 'blob' });
    return response.data;
  },
};
