// Audit H12: a one-time notice for the login page after the app signs someone out on purpose (their account was deleted, or an existing
// account was refused for its age). It travels in sessionStorage, not in router state, because signing out lets the route guard send the
// page to /login by itself and that redirect would drop the state. It holds a fixed word, nothing about the person.
export type LoginNotice = 'account-deleted' | 'age-refused';

const KEY = 'vysvi-login-notice';

export function setLoginNotice(notice: LoginNotice): void {
  try {
    sessionStorage.setItem(KEY, notice);
  } catch {
    // storage blocked: the login page simply shows no notice
  }
}

// Reads the notice once (and clears it).
export function consumeLoginNotice(): LoginNotice | null {
  try {
    const value = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    return value === 'account-deleted' || value === 'age-refused' ? value : null;
  } catch {
    return null;
  }
}
