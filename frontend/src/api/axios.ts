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

// Response interceptor for handling token expiration and permission errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
