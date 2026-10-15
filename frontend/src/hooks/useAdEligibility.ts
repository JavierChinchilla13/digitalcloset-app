import { useAuthStore } from '../store/useAuthStore';
import { useConsent } from './useConsent';
import { isPaidAccount } from '../utils/storage';
import { getAdConfig, type AdConfig } from '../components/ads/adConfig';

// Task 97: the ad setup to show this visitor, or null for no ad. Ads are only for signed-in
// FREE accounts: never for a visitor who is not signed in, a paying (PREMIUM) account, or an
// admin, and never when no ad network is configured for the build.
// Task 99: and never before the visitor chose "Accept all" on the cookie banner - an ad network
// sets its own cookies and identifiers, so its script is not loaded without that permission.
export function useAdEligibility(): AdConfig | null {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const { allowsOptional } = useConsent();
  if (!allowsOptional || !isAuthenticated || !user || isPaidAccount(user)) return null;
  return getAdConfig();
}
