import { describe, expect, it } from 'vitest';

import { getApiErrorMessage, NETWORK_ERROR_MESSAGE, RATE_LIMIT_MESSAGE } from '../utils/apiError';

// Task 95: what a person reads when a request fails.
const FALLBACK = "Couldn't do that. Please try again.";
const http = (status: number, data?: unknown) => ({ response: { status, data } });

describe('getApiErrorMessage', () => {
  it("shows the server's reason (wrong password, email taken, not allowed...)", () => {
    expect(getApiErrorMessage(http(401, { message: 'Invalid email or password' }), FALLBACK)).toBe('Invalid email or password');
    expect(getApiErrorMessage(http(409, { message: 'An account with this email already exists' }), FALLBACK)).toBe(
      'An account with this email already exists'
    );
    expect(getApiErrorMessage(http(403, { message: 'Current password is incorrect' }), FALLBACK)).toBe('Current password is incorrect');
  });

  it('a validation failure shows the first field reason instead of "Validation failed"', () => {
    const err = http(400, { message: 'Validation failed', errors: { password: 'Password must be at least 8 characters' } });
    expect(getApiErrorMessage(err, FALLBACK)).toBe('Password must be at least 8 characters');
  });

  it('a 400 without field reasons shows its message', () => {
    expect(getApiErrorMessage(http(400, { message: 'This link is no longer valid' }), FALLBACK)).toBe('This link is no longer valid');
  });

  it('a server failure shows the screen\'s own sentence, not the generic server text', () => {
    expect(getApiErrorMessage(http(500, { message: 'An unexpected error occurred' }), FALLBACK)).toBe(FALLBACK);
    expect(getApiErrorMessage(http(501), FALLBACK)).toBe(FALLBACK);
  });

  it('too many requests says to wait (or shows the server\'s own sentence)', () => {
    expect(getApiErrorMessage(http(429), FALLBACK)).toBe(RATE_LIMIT_MESSAGE);
    expect(getApiErrorMessage(http(429, { message: 'Too many requests, try later' }), FALLBACK)).toBe('Too many requests, try later');
  });

  it('a gateway error (the host answering for a sleeping or restarting API) says the server can not be reached', () => {
    for (const status of [502, 503, 504]) {
      expect(getApiErrorMessage(http(status, 'Bad Gateway'), FALLBACK)).toBe(NETWORK_ERROR_MESSAGE);
    }
  });

  it('no answer at all (offline, asleep, timed out) says the server can not be reached', () => {
    expect(getApiErrorMessage({ isAxiosError: true, code: 'ERR_NETWORK', message: 'Network Error' }, FALLBACK)).toBe(NETWORK_ERROR_MESSAGE);
    expect(getApiErrorMessage({ isAxiosError: true, code: 'ECONNABORTED', message: 'timeout of 60000ms exceeded' }, FALLBACK)).toBe(
      NETWORK_ERROR_MESSAGE
    );
  });

  it('a bare Error gets the fallback (its wording is a bug, not for people), unless the flow writes its own sentences', () => {
    expect(getApiErrorMessage(new Error('Cannot read properties of undefined'), FALLBACK)).toBe(FALLBACK);
    expect(getApiErrorMessage(new Error('Failed to upload image'), FALLBACK, { ownMessages: true })).toBe('Failed to upload image');
  });

  it('anything unknown gets the fallback', () => {
    expect(getApiErrorMessage(undefined, FALLBACK)).toBe(FALLBACK);
    expect(getApiErrorMessage('boom', FALLBACK)).toBe(FALLBACK);
    expect(getApiErrorMessage(http(404, {}), FALLBACK)).toBe(FALLBACK);
  });
});
