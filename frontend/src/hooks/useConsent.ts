import { useConsentStore } from '../store/useConsentStore';

// Task 99: what the visitor has allowed. `allowsOptional` is true only after "Accept all": the
// gate for ads and error monitoring (never for what the app needs to run).
export function useConsent() {
  const choice = useConsentStore((state) => state.choice);
  return { choice, allowsOptional: choice === 'all' };
}
