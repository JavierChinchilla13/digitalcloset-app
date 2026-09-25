import { useCallback } from 'react';
import { useToast } from '../components/Toast';

// Runs a store mutation that the caller doesn't otherwise handle errors for
// (a button's onClick, say). The mutating store actions rethrow on failure, so
// without this an unhandled rejection would be all the user ever got - no
// feedback at all. Resolves true on success, false after showing an error toast.
export function useSafeAction() {
  const { showToast } = useToast();

  return useCallback(
    async (action: () => Promise<unknown>, failureMessage: string): Promise<boolean> => {
      try {
        await action();
        return true;
      } catch (err) {
        console.error(failureMessage, err);
        showToast(failureMessage, 'error');
        return false;
      }
    },
    [showToast]
  );
}
