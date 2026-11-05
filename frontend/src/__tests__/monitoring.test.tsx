import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Breadcrumb, ErrorEvent } from '@sentry/react';

import ErrorBoundary from '../components/ErrorBoundary';
import { useConsentStore } from '../store/useConsentStore';

// Task 104: error monitoring - off by default, started only with a DSN and "Accept all", and scrubbed.
const sentryMock = vi.hoisted(() => ({
  init: vi.fn(),
  captureException: vi.fn(),
  close: vi.fn(async () => true),
}));
vi.mock('@sentry/react', () => sentryMock);

type Monitoring = typeof import('../monitoring/sentry');

// A fresh copy of the module (it keeps its own "started" state) with the build's DSN set or empty.
async function loadMonitoring(dsn: string): Promise<Monitoring> {
  vi.resetModules();
  vi.stubEnv('VITE_SENTRY_DSN', dsn);
  return import('../monitoring/sentry');
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  useConsentStore.setState({ choice: 'unset', decidedAt: null, reopened: false });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('when monitoring starts', () => {
  it('does not start before the visitor accepts optional services', async () => {
    const monitoring = await loadMonitoring('https://key@o1.ingest.sentry.io/1');
    monitoring.initMonitoring();
    await settle();

    expect(sentryMock.init).not.toHaveBeenCalled();
    monitoring.reportError(new Error('x'));
    expect(sentryMock.captureException).not.toHaveBeenCalled();
  });

  it('does not start after "Only essentials"', async () => {
    useConsentStore.setState({ choice: 'essential' });
    const monitoring = await loadMonitoring('https://key@o1.ingest.sentry.io/1');
    monitoring.initMonitoring();
    await settle();

    expect(sentryMock.init).not.toHaveBeenCalled();
  });

  it('does not start without a DSN, even with consent', async () => {
    useConsentStore.setState({ choice: 'all' });
    const monitoring = await loadMonitoring('');
    monitoring.initMonitoring();
    await settle();

    expect(sentryMock.init).not.toHaveBeenCalled();
    monitoring.reportError(new Error('x'));
    expect(sentryMock.captureException).not.toHaveBeenCalled();
  });

  it('starts with a DSN and "Accept all", collecting no personal data and no tracing', async () => {
    useConsentStore.setState({ choice: 'all' });
    const monitoring = await loadMonitoring('https://key@o1.ingest.sentry.io/1');
    monitoring.initMonitoring();
    await settle();

    expect(sentryMock.init).toHaveBeenCalledTimes(1);
    const options = sentryMock.init.mock.calls[0][0];
    expect(options.dsn).toBe('https://key@o1.ingest.sentry.io/1');
    expect(options.tracesSampleRate).toBe(0);
    expect(options.dataCollection).toMatchObject({ userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false });
    // Errors only: no replay, no tracing integration is configured.
    expect(options.integrations).toBeUndefined();
    expect(options.replaysSessionSampleRate).toBeUndefined();

    monitoring.reportError(new Error('boom'), 'in Page');
    expect(sentryMock.captureException).toHaveBeenCalledTimes(1);
  });

  it('starts when consent is given later and stops when it is withdrawn', async () => {
    const monitoring = await loadMonitoring('https://key@o1.ingest.sentry.io/1');
    // The reloaded module has its own copy of the consent store: drive that one.
    const { useConsentStore: store } = await import('../store/useConsentStore');
    monitoring.initMonitoring();
    await settle();
    expect(sentryMock.init).not.toHaveBeenCalled();

    store.setState({ choice: 'all' });
    await settle();
    expect(sentryMock.init).toHaveBeenCalledTimes(1);

    store.setState({ choice: 'essential' });
    await settle();
    expect(sentryMock.close).toHaveBeenCalled();
    monitoring.reportError(new Error('after withdrawal'));
    expect(sentryMock.captureException).not.toHaveBeenCalled();
  });
});

describe('scrubbing', () => {
  it('blanks emails and token-like strings', async () => {
    const { scrubText } = await loadMonitoring('');
    expect(scrubText('Key (email)=(ana@example.com) clash')).toBe('Key (email)=([email]) clash');
    expect(scrubText('jwt eyJhbGciOiJIUzI1NiJ9abcdefghijklmnopqrstuvwxyz end')).toBe('jwt [token] end');
    expect(scrubText('plain')).toBe('plain');
  });

  it('cuts the query string and fragment from URLs (a reset link carries its token there)', async () => {
    const { scrubUrl } = await loadMonitoring('');
    expect(scrubUrl('https://site.test/reset-password?token=SECRET123#x')).toBe('https://site.test/reset-password');
    expect(scrubUrl('/closet')).toBe('/closet');
  });

  it('removes identifying request data and user from an event', async () => {
    const { scrubEvent } = await loadMonitoring('');
    const event = {
      user: { email: 'a@b.com', ip_address: '1.2.3.4' },
      message: 'failed for a@b.com',
      request: {
        url: 'https://site.test/reset-password?token=SECRET',
        headers: { Authorization: 'Bearer abc' },
        cookies: { a: 'b' },
        query_string: 'token=SECRET',
        data: 'x',
      },
      exception: { values: [{ type: 'Error', value: 'bad token ' + 'A'.repeat(40) }] },
      breadcrumbs: [
        { category: 'navigation', data: { from: '/a?x=1', to: '/reset-password?token=SECRET' } },
        { category: 'fetch', message: 'POST user@x.org', data: { url: 'https://api.test/auth/login?email=a@b.com' } },
      ],
    } as unknown as ErrorEvent;

    const clean = scrubEvent(event);

    expect(clean.user).toBeUndefined();
    expect(clean.message).toBe('failed for [email]');
    expect(clean.request?.url).toBe('https://site.test/reset-password');
    expect(clean.request?.headers).toBeUndefined();
    expect(clean.request?.cookies).toBeUndefined();
    expect(clean.request?.query_string).toBeUndefined();
    expect(clean.request?.data).toBeUndefined();
    expect(clean.exception?.values?.[0].value).toBe('bad token [token]');
    expect(clean.breadcrumbs?.[0].data).toEqual({ from: '/a', to: '/reset-password' });
    expect(clean.breadcrumbs?.[1].message).toBe('POST [email]');
    expect(clean.breadcrumbs?.[1].data?.url).toBe('https://api.test/auth/login');
    expect(JSON.stringify(clean)).not.toContain('SECRET');
  });

  it('drops console breadcrumbs and keeps the rest', async () => {
    const { scrubBreadcrumb } = await loadMonitoring('');
    expect(scrubBreadcrumb({ category: 'console', message: 'axios error with headers' } as Breadcrumb)).toBeNull();
    expect(scrubBreadcrumb({ category: 'ui.click', message: 'button' } as Breadcrumb)).not.toBeNull();
  });
});

describe('which API failures are reported', () => {
  it('reports real server errors but not client errors or the host waking up', async () => {
    const { isReportableApiStatus } = await loadMonitoring('');
    expect(isReportableApiStatus(500)).toBe(true);
    expect(isReportableApiStatus(501)).toBe(true);
    for (const quiet of [502, 503, 504, 404, 403, 401, 400, 429, undefined]) {
      expect(isReportableApiStatus(quiet)).toBe(false);
    }
  });

  it('describes the failing call without ids, query or host', async () => {
    const { describeApiFailure } = await loadMonitoring('');
    expect(describeApiFailure(500, 'put', '/outfits/42?x=1')).toBe('API 500 PUT /outfits/:id');
    expect(describeApiFailure(500, undefined, 'https://api.test/api/outfits/7/share')).toBe('API 500 GET /api/outfits/:id/share');
    expect(describeApiFailure(500, 'get', '/public/outfits/' + 'k'.repeat(24 + 10))).toBe('API 500 GET /public/outfits/:token');
  });

  it('a 500 from the API is reported once; a 404 is not', async () => {
    useConsentStore.setState({ choice: 'all' });
    const monitoring = await loadMonitoring('https://key@o1.ingest.sentry.io/1');
    monitoring.initMonitoring();
    await settle();

    monitoring.reportApiFailure(404, 'get', '/outfits/1');
    monitoring.reportApiFailure(503, 'get', '/outfits/1');
    expect(sentryMock.captureException).not.toHaveBeenCalled();

    monitoring.reportApiFailure(500, 'post', '/outfits');
    expect(sentryMock.captureException).toHaveBeenCalledTimes(1);
    expect((sentryMock.captureException.mock.calls[0][0] as Error).message).toBe('API 500 POST /outfits');
  });
});

describe('the error boundary', () => {
  it('reports a crash once when monitoring is on', async () => {
    useConsentStore.setState({ choice: 'all' });
    vi.stubEnv('VITE_SENTRY_DSN', 'https://key@o1.ingest.sentry.io/1');
    vi.resetModules();
    const { initMonitoring } = await import('../monitoring/sentry');
    const { default: Boundary } = await import('../components/ErrorBoundary');
    initMonitoring();
    await settle();
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const Crash = () => {
      throw new Error('render crash');
    };
    render(
      <Boundary fallback={() => <p>fallback shown</p>}>
        <Crash />
      </Boundary>
    );

    expect(screen.getByText('fallback shown')).toBeInTheDocument();
    expect(sentryMock.captureException).toHaveBeenCalledTimes(1);
    expect((sentryMock.captureException.mock.calls[0][0] as Error).message).toBe('render crash');
  });

  it('shows the same fallback and reports nothing when monitoring is off', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const Crash = () => {
      throw new Error('render crash');
    };
    render(
      <ErrorBoundary fallback={() => <p>fallback shown</p>}>
        <Crash />
      </ErrorBoundary>
    );

    expect(screen.getByText('fallback shown')).toBeInTheDocument();
    expect(sentryMock.captureException).not.toHaveBeenCalled();
  });
});
