// Audit H12: the one answer given to anyone refused for the birth month/year they entered. It never says why, nor what the minimum age is
// (a neutral age screen: the form must not teach people what to type).
export const AGE_BLOCKED_MESSAGE = "We can't create an account with this information.";

const KEY = 'vysvi-age-blocked';

// Remembers, for this browser tab only, that a sign-up was refused for age, so going back and changing the year does not get around it.
// It stores a flag and nothing else: no date, no email, nothing about the person (sessionStorage is wiped when the tab closes).
export function markAgeBlocked(): void {
  try {
    sessionStorage.setItem(KEY, '1');
  } catch {
    // storage blocked: the refusal still applies for this page view
  }
}

export function isAgeBlocked(): boolean {
  try {
    return sessionStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

// True for the server's uniform refusal of a sign-up (HTTP 403, code AGE_NOT_ALLOWED).
export function isAgeRefusal(err: unknown): boolean {
  const response = (err as { response?: { status?: number; data?: { code?: unknown } } } | null)?.response;
  return response?.status === 403 && response?.data?.code === 'AGE_NOT_ALLOWED';
}
