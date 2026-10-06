// Task 95: one place that turns a failed request into a sentence a person can act on.
// Before this, every screen read `err.response?.data?.message || 'something'` itself, so:
//   - a server that was asleep / unreachable looked like "Invalid credentials" (no response
//     at all, so the screen fell back to its default text);
//   - a validation failure said only "Validation failed" (the reasons are in `errors`);
//   - the stores showed axios's own text ("Request failed with status code 500").

export const NETWORK_ERROR_MESSAGE =
  "Can't reach the server. Check your connection, or wait a minute if the site was idle, then try again.";
export const RATE_LIMIT_MESSAGE = 'Too many attempts. Please wait a minute and try again.';

interface ErrorLike {
  message?: unknown;
  code?: unknown;
  isAxiosError?: unknown;
  response?: { status?: number; data?: { message?: unknown; errors?: unknown } | null };
}

const asText = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

// The first reason out of the backend's validation answer ({ message: 'Validation
// failed', errors: { field: 'reason' } }).
const firstFieldError = (errors: unknown): string | null => {
  if (!errors || typeof errors !== 'object') return null;
  for (const value of Object.values(errors)) {
    const text = asText(value);
    if (text) return text;
  }
  return null;
};

/**
 * The message to show for a failed call.
 * - the server answered with a reason (wrong password, email taken, a validation rule,
 *   "not allowed") -> that reason;
 * - the server answered 429 -> a wait-and-retry sentence;
 * - a gateway answer (502 / 503 / 504: the host's proxy while the API is starting up or
 *   down, which is what a sleeping free-tier server returns) -> the same "can't reach the
 *   server" sentence as no answer at all;
 * - the server failed (other 5xx) -> `fallback`, the screen's own "what we were doing" sentence
 *   (the server's message for these is deliberately generic);
 * - there was no answer at all (offline, server asleep, timed out) -> a "can't reach the
 *   server" sentence, not whatever the screen's default would have claimed;
 * - anything else -> `fallback`, unless `ownMessages` is set: a few flows (image upload and
 *   processing) throw their own Error with a sentence written for the user, and that
 *   sentence is kept. A bare Error elsewhere is a bug's wording ("Cannot read properties
 *   of undefined"), not something to show.
 */
export function getApiErrorMessage(err: unknown, fallback: string, options: { ownMessages?: boolean } = {}): string {
  if (!err || typeof err !== 'object') return fallback;
  const e = err as ErrorLike;
  const response = e.response;

  if (response) {
    const status = typeof response.status === 'number' ? response.status : 0;
    if (status === 502 || status === 503 || status === 504) return NETWORK_ERROR_MESSAGE;
    if (status >= 500) return fallback;
    const data = response.data ?? undefined;
    const reason = (status === 400 ? firstFieldError(data?.errors) : null) ?? asText(data?.message);
    if (reason) return reason;
    if (status === 429) return RATE_LIMIT_MESSAGE;
    return fallback;
  }

  // A request that never got an answer.
  if (e.isAxiosError === true || e.code === 'ERR_NETWORK' || e.code === 'ECONNABORTED' || e.code === 'ETIMEDOUT') {
    return NETWORK_ERROR_MESSAGE;
  }
  return options.ownMessages ? (asText(e.message) ?? fallback) : fallback;
}
