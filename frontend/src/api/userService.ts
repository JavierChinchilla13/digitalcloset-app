import api from './axios';
import type { User } from '../types';

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
};
