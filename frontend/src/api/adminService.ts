import api from './axios';
import type { Plan, Role, User } from '../types';

export interface CreateUserRequest {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  role: Role;
}

// Admin-only endpoints (UserController). The backend enforces the role with
// @PreAuthorize("hasRole('ADMIN')"); the frontend's own admin guard is only a
// convenience so non-admins never see a page that would just fail.
export const adminService = {
  getUsers: async (): Promise<User[]> => {
    const response = await api.get<User[]>('/users');
    return response.data;
  },

  // Task 79: the only way to create an admin account - an existing admin
  // explicitly picks the role. Also just a normal "create a user" for when
  // an admin needs to hand someone an account directly.
  createUser: async (data: CreateUserRequest): Promise<User> => {
    const response = await api.post<User>('/users', data);
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

  // Task 96: gives an account the FREE or PREMIUM plan (more garment space, no ads).
  setPlan: async (userId: number, plan: Plan): Promise<User> => {
    const response = await api.patch<User>(`/users/${userId}/plan`, { plan });
    return response.data;
  },
};
