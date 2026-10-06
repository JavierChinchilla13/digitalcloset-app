import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';

// Task 24: '/api' is right whenever the site and the API share an origin - the
// Vite dev server proxies it, and in production the reverse proxy (Caddy, see
// DEPLOYMENT.md) does. VITE_API_URL is only for a split deployment where the
// frontend is hosted separately from the backend, e.g.
// https://api.example.com/api (the backend's CORS_ALLOWED_ORIGINS must then
// include the frontend's address). It is baked in at build time.
export const API_BASE_URL: string = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  // Task 95: without a limit a request to a server that never answers kept its spinner
  // forever. A sleeping free-tier API takes up to about a minute to wake, so wait that long.
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for adding JWT token
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor: ends a signed-in session the server no longer accepts.
//
// Task 95: this used to treat EVERY 401 and 403 as "the session expired" - log out and
// reload /login - so a wrong password on the sign-in form (a 401), or a refused action such
// as "Current password is incorrect" (a 403), wiped the page before its error message could
// be seen. Now only a 401 on a request that carried a token, and that was not an /auth/
// form (login, register, forgot / reset password), counts. The backend answers a missing,
// expired or invalid token with a 401 and every "you may not do that" with a 403.
const SESSION_EXPIRED_KEY = 'session-expired';

// True once, right after the app sent the visitor back to /login because their session ended
// (the login page shows a notice, then forgets it).
export const consumeSessionExpiredNotice = (): boolean => {
  try {
    const expired = sessionStorage.getItem(SESSION_EXPIRED_KEY) === '1';
    sessionStorage.removeItem(SESSION_EXPIRED_KEY);
    return expired;
  } catch {
    return false;
  }
};

export const isSessionExpiry = (error: {
  response?: { status?: number };
  config?: { url?: string; headers?: { Authorization?: unknown } };
}): boolean => {
  if (error.response?.status !== 401) return false;
  const hadToken = Boolean(error.config?.headers?.Authorization);
  const isAuthForm = (error.config?.url ?? '').startsWith('/auth/');
  return hadToken && !isAuthForm;
};

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (isSessionExpiry(error)) {
      useAuthStore.getState().logout();
      try {
        sessionStorage.setItem(SESSION_EXPIRED_KEY, '1');
      } catch {
        // storage blocked: the visitor just lands on the login page without the notice
      }
      // A full load (not a client-side redirect) so nothing of the previous session
      // stays in memory.
      window.location.assign('/login');
    }
    return Promise.reject(error);
  }
);

export default api;
