import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Role } from '../types';
import type { User } from '../types';
import { clearStoredAccountData } from '../utils/accountData';

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (token: string, user: User) => void;
  setToken: (token: string) => void;
  logout: () => void;
}

// Who is signed in: the JWT and the user, kept in localStorage ("auth-storage") so a
// refresh stays signed in. The axios client reads `token` for every request and calls
// `logout` when the server answers 401/403. `isAdmin` is derived once at login.
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      isAdmin: false,
      // Signs in: stores the token and user and works out isAdmin from the role.
      login: (token, user) => set({ 
        token, 
        user, 
        isAuthenticated: true, 
        isAdmin: user.role === Role.ROLE_ADMIN 
      }),
      // Sets only the token - needed in the middle of login/signup, when the next request (fetching the user) must already carry it.
      setToken: (token) => set({ token }),
      // Forgets the session and wipes the account's data saved in this browser (audit H4). The in-memory
      // stores are emptied by resetAccountStores() where the app signs out without reloading the page.
      logout: () => {
        clearStoredAccountData();
        set({ token: null, user: null, isAuthenticated: false, isAdmin: false });
      },
    }),
    {
      name: 'auth-storage',
    }
  )
);
