import { Plan, Role } from '../types';
import type { User } from '../types';

// Task 96: how much garment space an account has left. The backend decides the limit (15 free,
// 300 paying, none for admins) and sends it as `user.garmentLimit`; this only does the arithmetic
// the screens need, so no screen repeats the rule.

export interface StorageUsage {
  // Garments the account holds right now.
  used: number;
  // The account's limit; null = unlimited (admins), and also when it is not known yet.
  limit: number | null;
  // Slots left (null when unlimited).
  remaining: number | null;
  unlimited: boolean;
  atLimit: boolean;
  // Whether `count` more garments fit (a shoe pair is 2).
  canAdd: (count: number) => boolean;
  isPaid: boolean;
}

// A paying account or an admin: the accounts with no ads and the bigger (or no) garment limit.
export function isPaidAccount(user: Pick<User, 'role' | 'plan'> | null | undefined): boolean {
  return user?.plan === Plan.PREMIUM || user?.role === Role.ROLE_ADMIN;
}

/**
 * Works out the storage state for `user` holding `used` garments. A missing user, or a
 * user the server sent without a limit, is treated as unlimited: the client never blocks
 * on a guess, and the server enforces the real limit anyway.
 */
export function computeStorage(user: Pick<User, 'role' | 'plan' | 'garmentLimit'> | null | undefined, used: number): StorageUsage {
  const limit = user && typeof user.garmentLimit === 'number' ? user.garmentLimit : null;
  const unlimited = limit === null;
  const remaining = limit === null ? null : Math.max(limit - used, 0);
  return {
    used,
    limit,
    remaining,
    unlimited,
    atLimit: !unlimited && used >= (limit as number),
    canAdd: (count: number) => unlimited || used + count <= (limit as number),
    isPaid: isPaidAccount(user),
  };
}

// Thrown before a save when the closet has no room (the server refuses too, with a 403). Its
// message is already a sentence for the user, so the save screens show it as it is.
export class StorageLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageLimitError';
  }
}

// The sentence shown when a free or paying account has no room left.
export function limitMessage(storage: StorageUsage): string {
  if (storage.limit === null) return '';
  return `You've used ${storage.used} of ${storage.limit} garments. Delete a garment to add another. Plans with more space are coming soon.`;
}
