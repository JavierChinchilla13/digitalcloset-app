// Audit H4: what one account leaves in this browser, and the way to wipe it when the account signs
// out. The closet cache, the favourites and the persona choice are saved per browser, not per
// account, so without this the next person on a shared computer would see the previous closet.
// Kept free of imports (no stores) so the auth store and the HTTP client can use it without cycles.

// localStorage keys that hold an account's data. (The theme, the cookie choice and the first-run
// "hidden" flag are not account data: the last is namespaced per user already.)
export const ACCOUNT_STORAGE_KEYS = ['clothing-closet-storage', 'closet-favorites', 'persona-storage'] as const;

// Removes the saved account data from this browser (best effort: blocked storage is ignored).
export function clearStoredAccountData(): void {
  for (const key of ACCOUNT_STORAGE_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch {
      // storage blocked: nothing was saved there in the first place
    }
  }
}
