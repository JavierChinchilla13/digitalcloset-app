import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../api/authService';
import { useAuthStore } from '../store/useAuthStore';

// Task 98: the last steps of every way of signing in - the password form, account creation and
// "Sign in with Google" all end the same way: keep the token (the next request needs it in its header),
// fetch the account (role, plan, name), store both, and land on the Showcase. If fetching the account
// fails, the half-stored token is thrown away and the error is passed on for the caller to show.
export function useCompleteSignIn() {
  const setToken = useAuthStore((state) => state.setToken);
  const login = useAuthStore((state) => state.login);
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();

  return useCallback(
    async (token: string) => {
      setToken(token);
      try {
        const user = await authService.getCurrentUser();
        login(token, user);
        navigate('/showcase');
      } catch (err) {
        logout();
        throw err;
      }
    },
    [setToken, login, logout, navigate]
  );
}
