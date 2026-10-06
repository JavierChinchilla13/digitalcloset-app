import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError, type InternalAxiosRequestConfig } from 'axios';

import api, { consumeSessionExpiredNotice, isSessionExpiry } from '../api/axios';
import { useAuthStore } from '../store/useAuthStore';
import { Role } from '../types';

// Task 95: only a 401 on a signed-in request (not a login / register form) ends the session.
// Before, every 401 and 403 logged out and reloaded /login, so a wrong password wiped the
// sign-in page's error message and "Current password is incorrect" signed the user out.
const ME = { userId: 1, email: 'me@example.com', role: Role.ROLE_USER, active: true, createdAt: '2026-01-01T00:00:00' };

const assign = vi.fn();
const realAdapter = api.defaults.adapter;

// Makes the next request fail like the server answered `status`.
function serverAnswers(status: number, data: unknown = {}) {
  api.defaults.adapter = (config: InternalAxiosRequestConfig) =>
    Promise.reject(
      new AxiosError('failed', 'ERR_BAD_REQUEST', config, null, {
        status,
        statusText: '',
        data,
        headers: {},
        config,
      })
    );
}

beforeEach(() => {
  assign.mockClear();
  vi.stubGlobal('location', { assign });
  sessionStorage.clear();
  useAuthStore.getState().login('tok', ME as never);
});

afterEach(() => {
  api.defaults.adapter = realAdapter;
  vi.unstubAllGlobals();
  useAuthStore.getState().logout();
});

describe('which failures end the session', () => {
  it('a 401 on a signed-in request logs out, remembers why, and returns to /login', async () => {
    serverAnswers(401, { message: 'Your session has expired. Please sign in again.' });

    await expect(api.get('/clothing')).rejects.toBeTruthy();

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(assign).toHaveBeenCalledWith('/login');
    expect(consumeSessionExpiredNotice()).toBe(true);
    expect(consumeSessionExpiredNotice()).toBe(false); // read once
  });

  it('a wrong password (401 from /auth/login) does not log out or reload the page', async () => {
    serverAnswers(401, { message: 'Invalid email or password' });

    const err = await api.post('/auth/login', { email: 'a@b.c', password: 'x' }).catch((e) => e);

    expect(err.response.data.message).toBe('Invalid email or password');
    expect(assign).not.toHaveBeenCalled();
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(consumeSessionExpiredNotice()).toBe(false);
  });

  it('a refused action (403, e.g. "Current password is incorrect") keeps the user signed in', async () => {
    serverAnswers(403, { message: 'Current password is incorrect' });

    await expect(api.post('/users/me/password/request', {})).rejects.toBeTruthy();

    expect(assign).not.toHaveBeenCalled();
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('other failures (400, 404, 409, 500) do not touch the session', async () => {
    for (const status of [400, 404, 409, 500]) {
      serverAnswers(status);
      await expect(api.get('/clothing')).rejects.toBeTruthy();
    }
    expect(assign).not.toHaveBeenCalled();
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('a 401 for a request that carried no token is not a session ending', () => {
    expect(isSessionExpiry({ response: { status: 401 }, config: { url: '/clothing', headers: {} } })).toBe(false);
  });
});
