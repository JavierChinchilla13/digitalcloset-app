import api from './axios';
import type { User } from '../types';

// Admin-only endpoints (UserController). The backend enforces the role with
// @PreAuthorize("hasRole('ADMIN')"); the frontend's own admin guard is only a
// convenience so non-admins never see a page that would just fail.
export const adminService = {
  getUsers: async (): Promise<User[]> => {
    const response = await api.get<User[]>('/users');
    return response.data;
  },

  deactivateUser: async (userId: number): Promise<User> => {
    const response = await api.patch<User>(`/users/${userId}/deactivate`);
    return response.data;
  },

  reactivateUser: async (userId: number): Promise<User> => {
    const response = await api.patch<User>(`/users/${userId}/reactivate`);
    return response.data;
  },
};
