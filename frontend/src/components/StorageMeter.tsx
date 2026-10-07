import { useStorage } from '../hooks/useStorage';

// Task 96: "7 / 15 garments" with a thin bar, for accounts that have a limit. Shows nothing
// for unlimited accounts (admins) or before the limit is known. `compact` is the one-line
// version for the menus.
const StorageMeter = ({ compact = false, className = '' }: { compact?: boolean; className?: string }) => {
  const { used, limit, atLimit } = useStorage();
  if (limit === null) return null;

  const percent = Math.min(100, Math.round((used / limit) * 100));
  return (
    <div className={className} data-testid="storage-meter">
      <p className={`text-[10px] font-medium uppercase tracking-widest ${atLimit ? 'text-red-400' : 'text-text-secondary'}`}>
        {used} / {limit} garments
      </p>
      {!compact && (
        <div
          role="progressbar"
          aria-label="Garment storage used"
          aria-valuemin={0}
          aria-valuemax={limit}
          aria-valuenow={Math.min(used, limit)}
          className="mt-2 h-1 w-full rounded-full bg-ink/10 overflow-hidden"
        >
          <div className={`h-full rounded-full ${atLimit ? 'bg-red-400' : 'bg-accent'}`} style={{ width: `${percent}%` }} />
        </div>
      )}
    </div>
  );
};

export default StorageMeter;
