import { useEffect } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { useBillingStore } from '../store/useBillingStore';

// The account the held billing status belongs to (module-wide, like the store): a different account
// signing in must not see the previous one's status.
let statusOwner: number | null = null;

// Task 103: the billing status of the signed-in account, loaded on first use and again when the account changes.
export function useBilling() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const userId = useAuthStore((state) => state.user?.userId ?? null);
  const status = useBillingStore((state) => state.status);
  const load = useBillingStore((state) => state.load);
  const reset = useBillingStore((state) => state.reset);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (statusOwner !== userId) {
      statusOwner = userId;
      reset();
    }
    void load();
  }, [isAuthenticated, userId, load, reset]);

  return { status, enabled: !!status?.enabled };
}
