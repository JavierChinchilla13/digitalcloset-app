import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { premiumInterestService, type PremiumInterestSummary } from '../api/premiumInterestService';

// Admin: how many people asked for Premium while payments are off, and when the latest request was. A number and a date only: no account
// is named. Shows nothing if the count cannot be loaded.
const AdminPremiumInterest = () => {
  const [summary, setSummary] = useState<PremiumInterestSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    premiumInterestService
      .getAdminSummary()
      .then((value) => {
        if (!cancelled) setSummary(value);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!summary) return null;

  const latest = summary.latestAt
    ? new Date(summary.latestAt.endsWith('Z') ? summary.latestAt : `${summary.latestAt}Z`).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  return (
    <p className="flex items-center gap-2 text-text-secondary text-xs font-medium uppercase tracking-widest" data-testid="premium-interest-count">
      <Sparkles size={14} aria-hidden />
      <span>
        Premium requests: <strong className="text-text-primary tabular-nums">{summary.count}</strong>
        {latest && <> (latest {latest})</>}
      </span>
    </p>
  );
};

export default AdminPremiumInterest;
