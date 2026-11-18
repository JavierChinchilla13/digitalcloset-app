import { useAuthStore } from '../store/useAuthStore';
import { Plan, Role } from '../types';
import { useBilling } from './useBilling';

// Whether to show "Premium is coming soon / Request Premium": payments are NOT set up on the server (the same all-or-none rule the billing
// code uses, as the billing status reports it), and the account is a declared adult who has confirmed their details (the rule that gates
// Premium itself), is not an admin, and does not already have Premium. False while the billing status is still loading, so nothing flashes.
export function usePremiumInterestEligible(): boolean {
  const user = useAuthStore((state) => state.user);
  const { status, enabled } = useBilling();
  if (!status || enabled || !user) return false;
  if (user.ageBand !== 'ADULT' || user.needsLegalConfirmation) return false;
  if (user.role === Role.ROLE_ADMIN || user.plan === Plan.PREMIUM) return false;
  return true;
}
