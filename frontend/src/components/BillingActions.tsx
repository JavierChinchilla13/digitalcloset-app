import { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { billingService } from '../api/billingService';
import { useBilling } from '../hooks/useBilling';
import { useAuthStore } from '../store/useAuthStore';
import { getApiErrorMessage } from '../utils/apiError';
import { Plan, Role } from '../types';

interface BillingActionsProps {
  // 'block' fills the width (the Settings card, the closet-full dialog).
  className?: string;
}

// Task 103: the Premium call to action. A free account (when payments are set up) gets "Upgrade to
// Premium", which goes to Stripe Checkout; an account with a Stripe subscription gets "Manage billing",
// which opens Stripe's portal, and a note when the subscription will not renew. Renders nothing for
// admins, and nothing at all when payments are not set up on the server.
const BillingActions = ({ className = '' }: BillingActionsProps) => {
  const user = useAuthStore((state) => state.user);
  const { status, enabled } = useBilling();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!enabled || !status || !user || user.role === Role.ROLE_ADMIN) return null;

  // Both actions end by leaving the site for a Stripe page.
  const go = async (getUrl: () => Promise<string>, fallback: string) => {
    setBusy(true);
    setError(null);
    try {
      window.location.assign(await getUrl());
    } catch (err) {
      setError(getApiErrorMessage(err, fallback));
      setBusy(false);
    }
  };

  const isFree = user.plan !== Plan.PREMIUM;
  const endsOn = status.currentPeriodEnd
    ? new Date(status.currentPeriodEnd).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <div className={`space-y-2 ${className}`} data-testid="billing-actions">
      {isFree && (
        <button
          type="button"
          disabled={busy}
          onClick={() => go(billingService.startCheckout, "Couldn't open the checkout. Please try again.")}
          className="w-full py-3.5 bg-accent text-on-accent text-[10px] font-medium uppercase tracking-widest rounded-xl inline-flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          Upgrade to Premium{status.priceLabel ? ` - ${status.priceLabel}` : ''}
        </button>
      )}
      {!isFree && status.canManage && (
        <>
          {status.cancelAtPeriodEnd && endsOn && (
            <p className="text-[10px] text-text-secondary normal-case tracking-normal">
              Premium ends on {endsOn} and will not renew.
            </p>
          )}
          {status.subscriptionStatus === 'past_due' && (
            <p className="text-[10px] text-amber-400 normal-case tracking-normal">
              Your last payment failed. Update your card to keep Premium.
            </p>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => go(billingService.openPortal, "Couldn't open the billing page. Please try again.")}
            className="w-full py-3.5 border border-ink/15 text-text-primary text-[10px] font-medium uppercase tracking-widest rounded-xl inline-flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {busy && <Loader2 size={14} className="animate-spin" />} Manage billing
          </button>
        </>
      )}
      {error && (
        <p role="alert" className="text-xs text-rose-400 normal-case tracking-normal">
          {error}
        </p>
      )}
    </div>
  );
};

export default BillingActions;
