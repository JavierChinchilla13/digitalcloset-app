import api from './axios';
import type { AuthResponse, User } from '../types';

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

  clearMainOutfit: async (): Promise<User> => {
    const response = await api.delete<User>('/users/me/main-outfit');
    return response.data;
  },

  // Task 79 (Settings page):
  updateProfile: async (data: { firstName?: string; lastName?: string }): Promise<User> => {
    const response = await api.put<User>('/users/me', data);
    return response.data;
  },

  // Task 79 follow-up: changing either requires confirming a 6-digit code
  // emailed to the account's current address - request stages the change,
  // confirm applies it. Email's confirm returns a fresh token, since email is
  // the login identifier and the old token's subject stops resolving the
  // instant it's applied; password's confirm doesn't need one.
  requestPasswordChange: async (currentPassword: string, newPassword: string): Promise<void> => {
    await api.post('/users/me/password/request', { currentPassword, newPassword });
  },

  confirmPasswordChange: async (code: string): Promise<void> => {
    await api.post('/users/me/password/confirm', { code });
  },

  requestEmailChange: async (newEmail: string, currentPassword: string): Promise<void> => {
    await api.post('/users/me/email/request', { newEmail, currentPassword });
  },

  confirmEmailChange: async (code: string): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/users/me/email/confirm', { code });
    return response.data;
  },

  deactivateMe: async (): Promise<void> => {
    await api.patch('/users/me/deactivate');
  },
};
