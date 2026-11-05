import { HardDrive, X } from 'lucide-react';
import ModalShell from './ModalShell';
import { useStorage } from '../hooks/useStorage';
import { limitMessage } from '../utils/storage';
import { useBilling } from '../hooks/useBilling';
import BillingActions from './BillingActions';
import { Plan } from '../types';
import { useAuthStore } from '../store/useAuthStore';

// Task 96: shown instead of the upload wizard when the account has no garment space left.
// Opening the wizard only to fail at the end would waste the Cloudinary upload, so the
// "Add New Garment" button checks first (and UploadFlow checks again).
const StorageLimitModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const storage = useStorage();
  const { enabled } = useBilling();
  const isFree = useAuthStore((state) => state.user?.plan) !== Plan.PREMIUM;
  return (
    <ModalShell isOpen={isOpen} onClose={onClose} className="max-w-md bg-background-secondary border border-ink/5 rounded-2xl shadow-lg">
      <div role="dialog" aria-modal="true" aria-label="Closet is full" className="relative p-8 text-center space-y-5">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 w-10 h-10 flex items-center justify-center rounded-full text-text-secondary hover:text-text-primary hover:bg-ink/5"
        >
          <X size={18} />
        </button>
        <div className="mx-auto w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center text-accent">
          <HardDrive size={20} />
        </div>
        <h2 className="text-text-primary text-lg font-light tracking-tight uppercase">Your closet is full</h2>
        <p className="text-text-secondary text-xs leading-relaxed">{limitMessage(storage)}</p>
        {/* Task 103: with payments set up, the way out is right here; otherwise say more space is planned. */}
        {enabled && isFree ? (
          <BillingActions />
        ) : (
          isFree && <p className="text-text-secondary text-xs leading-relaxed">Plans with more space are coming soon.</p>
        )}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-3.5 bg-ink text-background-main text-[10px] font-medium uppercase tracking-widest rounded-xl"
        >
          Got it
        </button>
      </div>
    </ModalShell>
  );
};

export default StorageLimitModal;
