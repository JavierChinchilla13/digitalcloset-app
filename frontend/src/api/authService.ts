import api from './axios';
import type { AuthResponse, User } from '../types';

// Account entry endpoints (AuthController, /api/auth) plus the current-user lookup. register/login both return a JWT + the user.
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export const authService = {
  login: async (credentials: LoginRequest): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/login', credentials);
    return response.data;
  },

  register: async (userData: RegisterRequest): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/register', userData);
    return response.data;
  },

  // Always resolves with the same generic message, whether or not the email
  // has an account (the backend deliberately doesn't say).
  forgotPassword: async (email: string): Promise<{ message: string }> => {
    const response = await api.post<{ message: string }>('/auth/forgot-password', { email });
    return response.data;
  },

  // Step 2 of the password reset: the token from the emailed link and the new password. Single use; fails if the link is expired or already used.
  resetPassword: async (token: string, password: string): Promise<{ message: string }> => {
    const response = await api.post<{ message: string }>('/auth/reset-password', { token, password });
    return response.data;
  },

  // The signed-in user (GET /users/me) - used right after login to learn the role and name.
  getCurrentUser: async (): Promise<User> => {
    const response = await api.get<User>('/users/me');
    return response.data;
  }
};
