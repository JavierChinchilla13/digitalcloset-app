import type { Breadcrumb, ErrorEvent } from '@sentry/react';
import { useConsentStore } from '../store/useConsentStore';

// Task 104: error monitoring with Sentry, built to collect as little as possible.
// - Off unless VITE_SENTRY_DSN is set in the build AND the visitor chose "Accept all" on the cookie banner
//   (withdrawing that choice stops it again). Until then the Sentry code is not even downloaded: it is
//   loaded with a dynamic import() only when it is about to start, so first-load speed is unaffected.
// - Errors only: no performance tracing, no session replay (a replay would record emails and garment names).
// - Nothing identifying is attached: no user, no headers or cookies, query strings and fragments are cut from
//   every URL (a password-reset link carries a secret token there), console logging is not kept as breadcrumbs
//   (an axios error logs request details), and emails and token-like strings are blanked in every message.

type SentryModule = typeof import('@sentry/react');

let sentry: SentryModule | null = null;
let starting = false;
// Errors that happened while Sentry was loading (kept only after consent was given).
const pending: Array<{ error: unknown; componentStack?: string }> = [];

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// A long run of URL-safe characters: a JWT, a reset or share token, an API key.
const TOKEN = /[A-Za-z0-9_-]{32,}/g;

// The text with emails and token-like strings replaced by placeholders.
export function scrubText(text: string): string {
  return text.replace(EMAIL, '[email]').replace(TOKEN, '[token]');
}

// The URL without its query string and fragment (where tokens and personal values live).
export function scrubUrl(url: string): string {
  return url.replace(/[?#].*$/, '');
}

// Cleans an event just before it is sent (see the rules at the top of the file).
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  if (event.request) {
    if (event.request.url) event.request.url = scrubUrl(event.request.url);
    delete event.request.headers;
    delete event.request.cookies;
    delete event.request.query_string;
    delete event.request.data;
  }
  delete event.user;
  if (event.message) event.message = scrubText(event.message);
  for (const exception of event.exception?.values ?? []) {
    if (exception.value) exception.value = scrubText(exception.value);
  }
  event.breadcrumbs = (event.breadcrumbs ?? []).map(scrubBreadcrumbContent);
  return event;
}

// A breadcrumb's text and URL cleaned in place.
function scrubBreadcrumbContent(breadcrumb: Breadcrumb): Breadcrumb {
  if (breadcrumb.message) breadcrumb.message = scrubText(breadcrumb.message);
  const data = breadcrumb.data as Record<string, unknown> | undefined;
  if (data) {
    for (const key of ['url', 'from', 'to']) {
      if (typeof data[key] === 'string') data[key] = scrubUrl(data[key] as string);
    }
  }
  return breadcrumb;
}

// Decides which breadcrumbs are kept: console output is dropped (it can carry request details), the rest are cleaned.
export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  if (breadcrumb.category === 'console') return null;
  return scrubBreadcrumbContent(breadcrumb);
}

// Server failures worth a report: a 5xx other than the gateway answers (502/503/504 are the host's proxy while a
// sleeping free-tier API starts up - not a bug).
export function isReportableApiStatus(status: number | undefined): boolean {
  return typeof status === 'number' && status >= 500 && status !== 502 && status !== 503 && status !== 504;
}

// "API 500 GET /outfits/:id" - the failing call without ids, query or host, so identical failures group together.
export function describeApiFailure(status: number, method: string | undefined, url: string | undefined): string {
  const path = scrubUrl(url ?? '')
    .replace(/^https?:\/\/[^/]+/, '')
    .split('/')
    .map((segment) => (/^\d+$/.test(segment) ? ':id' : /^[A-Za-z0-9_-]{32,}$/.test(segment) ? ':token' : segment))
    .join('/');
  return `API ${status} ${(method ?? 'GET').toUpperCase()} ${path}`;
}

const dsn = () => (import.meta.env.VITE_SENTRY_DSN as string | undefined)?.trim() || '';

// Starts Sentry (downloading it first). Safe to call again: it only starts once.
async function start(): Promise<void> {
  if (sentry || starting || !dsn()) return;
  starting = true;
  try {
    const module = await import('@sentry/react');
    module.init({
      dsn: dsn(),
      environment: import.meta.env.MODE,
      // This SDK version collects user info, cookies, headers and bodies unless told not to: collect none of it.
      dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false },
      tracesSampleRate: 0,
      beforeSend: scrubEvent,
      beforeBreadcrumb: scrubBreadcrumb,
      // Noise that is not about this app: layout-observer chatter, offline network failures, browser
      // extensions and ad scripts.
      ignoreErrors: ['ResizeObserver loop', 'Non-Error promise rejection captured', 'Network Error', 'Failed to fetch', 'Load failed'],
      denyUrls: [/^chrome-extension:\/\//i, /^moz-extension:\/\//i, /googlesyndication\.com/i, /googletagmanager\.com/i, /adsterra/i],
    });
    sentry = module;
    for (const item of pending.splice(0)) send(item.error, item.componentStack);
  } catch {
    // Monitoring must never break the app: if it cannot load, the app simply runs without it.
  } finally {
    starting = false;
  }
}

// Stops Sentry (the visitor withdrew their consent) and forgets anything waiting.
async function stop(): Promise<void> {
  pending.length = 0;
  const current = sentry;
  sentry = null;
  try {
    await current?.close();
  } catch {
    // nothing to clean up
  }
}

function send(error: unknown, componentStack?: string): void {
  sentry?.captureException(error, componentStack ? { contexts: { react: { componentStack } } } : undefined);
}

// Reports an unexpected error. Does nothing unless monitoring is on (DSN set and consent given).
export function reportError(error: unknown, componentStack?: string): void {
  if (sentry) send(error, componentStack);
  else if (starting && pending.length < 10) pending.push({ error, componentStack });
}

// Reports a failed API call when it is a real server failure (see isReportableApiStatus).
export function reportApiFailure(status: number | undefined, method: string | undefined, url: string | undefined): void {
  if (!isReportableApiStatus(status)) return;
  reportError(new Error(describeApiFailure(status as number, method, url)));
}

// Wires monitoring to the cookie choice: starts when "Accept all" is chosen, stops when it is withdrawn.
export function initMonitoring(): void {
  const apply = () => {
    if (useConsentStore.getState().choice === 'all') void start();
    else void stop();
  };
  apply();
  useConsentStore.subscribe(apply);
}
