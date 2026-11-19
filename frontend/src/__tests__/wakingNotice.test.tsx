import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios';

import api from '../api/axios';
import WakingNotice from '../components/WakingNotice';
import { AWAKE_FOR_MS, WAKING_DELAY_MS, resetWakingNotice } from '../api/wakingNotice';
import { useLanguageStore } from '../i18n';

// Audit H11: the "waking the server" line. The requests below go through the app's real axios instance (so its interceptors run),
// but with a made-up adapter: nothing touches the network, and each test decides when (and how) a request is answered.
const EN = 'Waking the server, this can take up to a minute the first time…';
const ES = 'Despertando el servidor; la primera vez puede tardar hasta un minuto…';

interface Pending {
  config: InternalAxiosRequestConfig;
  answer: (status?: number) => void;
  fail: (status?: number) => void;
}
let pending: Pending[] = [];
let calls = 0;

// An adapter whose requests stay unanswered until the test answers or fails them.
const adapter: AxiosAdapter = (config) =>
  new Promise((resolve, reject) => {
    calls++;
    pending.push({
      config,
      answer: (status = 200) => resolve({ data: {}, status, statusText: '', headers: {}, config }),
      fail: (status) => reject(Object.assign(new Error('failed'), { config, response: status ? { status } : undefined })),
    });
  });

const send = (url = '/clothing') => {
  const request = api.get(url, { adapter });
  // The tests that fail a request look at the rejection themselves.
  request.catch(() => {});
  return request;
};

// (axios runs its interceptors a microtask after the call, so let those run before the clock moves.)
const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};
const advance = (ms: number) => act(async () => { await flush(); vi.advanceTimersByTime(ms); });
const settle = (fn: () => void) => act(async () => { await flush(); fn(); await flush(); });

beforeEach(() => {
  vi.useFakeTimers();
  pending = [];
  calls = 0;
  resetWakingNotice();
  useLanguageStore.getState().setLanguage('en');
});

afterEach(() => {
  vi.useRealTimers();
});

describe('the "waking the server" notice', () => {
  it('is not shown before the delay, appears after it, and the box is a polite status', async () => {
    render(<WakingNotice />);
    send();

    await advance(WAKING_DELAY_MS - 1);
    expect(screen.queryByText(EN)).not.toBeInTheDocument();

    await advance(1);
    expect(screen.getByText(EN)).toBeInTheDocument();
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toContainElement(screen.getByText(EN));
    // It never takes a click, so nothing underneath is blocked.
    expect(region.className).toContain('pointer-events-none');
  });

  it('disappears as soon as the response arrives', async () => {
    render(<WakingNotice />);
    send();
    await advance(WAKING_DELAY_MS);
    expect(screen.getByText(EN)).toBeInTheDocument();

    await settle(() => pending[0].answer());
    expect(screen.queryByText(EN)).not.toBeInTheDocument();
  });

  it('is never shown for a fast response', async () => {
    render(<WakingNotice />);
    send();
    await advance(1000);
    await settle(() => pending[0].answer());

    await advance(WAKING_DELAY_MS * 3);
    expect(screen.queryByText(EN)).not.toBeInTheDocument();
  });

  it('an error answer (a status) also removes it, and the request still fails normally, once', async () => {
    render(<WakingNotice />);
    const request = api.get('/clothing', { adapter });
    const outcome = request.then(() => 'ok', (error) => error.response?.status);
    await advance(WAKING_DELAY_MS);
    expect(screen.getByText(EN)).toBeInTheDocument();

    await settle(() => pending[0].fail(503));
    await expect(outcome).resolves.toBe(503);
    expect(screen.queryByText(EN)).not.toBeInTheDocument();
    // No retry of any kind: the one request is the only one that was made.
    await advance(AWAKE_FOR_MS);
    expect(calls).toBe(1);
  });

  it('a request that fails with no answer at all (a timeout) removes it too, with the normal error and no retry', async () => {
    render(<WakingNotice />);
    const outcome = api.get('/clothing', { adapter }).then(() => 'ok', () => 'failed');
    await advance(WAKING_DELAY_MS);
    expect(screen.getByText(EN)).toBeInTheDocument();

    await settle(() => pending[0].fail());
    await expect(outcome).resolves.toBe('failed');
    expect(screen.queryByText(EN)).not.toBeInTheDocument();
    await advance(AWAKE_FOR_MS);
    expect(calls).toBe(1);
  });

  it('once the server has answered it stays quiet for a slow request, until it could have gone to sleep again', async () => {
    render(<WakingNotice />);
    send();
    await advance(WAKING_DELAY_MS);
    await settle(() => pending[0].answer());

    send('/outfits');
    await advance(WAKING_DELAY_MS * 2);
    expect(screen.queryByText(EN)).not.toBeInTheDocument();
    await settle(() => pending[1].answer());

    // A tab left open past the idle time: the server may be asleep again.
    await advance(AWAKE_FOR_MS + 1000);
    send('/closet');
    await advance(WAKING_DELAY_MS);
    expect(screen.getByText(EN)).toBeInTheDocument();
  });

  it('several slow requests share one message, and an answer to any of them clears it', async () => {
    render(<WakingNotice />);
    send('/clothing');
    send('/outfits');
    await advance(WAKING_DELAY_MS);
    expect(screen.getAllByText(EN)).toHaveLength(1);

    await settle(() => pending[1].answer());
    expect(screen.queryByText(EN)).not.toBeInTheDocument();
  });

  it('is shown in Spanish when the site is in Spanish', async () => {
    useLanguageStore.getState().setLanguage('es');
    render(<WakingNotice />);
    send();
    await advance(WAKING_DELAY_MS);
    expect(screen.getByText(ES)).toBeInTheDocument();
  });
});
