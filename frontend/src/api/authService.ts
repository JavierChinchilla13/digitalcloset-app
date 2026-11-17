import api from './axios';
import type { AuthResponse, GoogleAuthResponse, User } from '../types';

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
  // Audit H12: birth month/year, the guardian declaration (13-17) and the two acceptances (see useAgeConsentForm).
  birthMonth: number;
  birthYear: number;
  guardianAuthorized: boolean;
  termsAccepted: boolean;
  dataAuthorized: boolean;
  legalVersion: string;
}

export interface GoogleCompleteRequest extends Omit<RegisterRequest, 'email' | 'password' | 'firstName' | 'lastName'> {
  credential: string;
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

  // Task 98: "Sign in with Google". `credential` is the signed ID token from Google's button; the backend checks
  // it and answers with this app's own token (creating or linking the account the first time).
  // Audit H12: a NEW Google identity gets { needsProfile: true, email } and nothing is created; see googleComplete.
  google: async (credential: string): Promise<GoogleAuthResponse> => {
    const response = await api.post<GoogleAuthResponse>('/auth/google', { credential });
    return response.data;
  },

  // Step 2 of a new Google sign-up: the same credential again plus birth month/year and the acceptances.
  googleComplete: async (body: GoogleCompleteRequest): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/google/complete', body);
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
