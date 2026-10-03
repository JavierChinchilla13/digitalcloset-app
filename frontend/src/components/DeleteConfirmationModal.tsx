import React, { useState } from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import { useClothingStore } from '../store/useClothingStore';
import { useToast } from './Toast';
import ModalShell from './ModalShell';

interface DeleteConfirmationModalProps {
  itemId: number | null;
  itemName: string;
  isOpen: boolean;
  onClose: () => void;
}

// "Are you sure?" dialog for deleting a garment. Deleting goes through the closet
// store (soft delete on the server) and reports the result as a toast; the dialog
// stays open and re-enabled if the delete fails, so the user can retry.
const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({ 
  itemId, 
  itemName, 
  isOpen, 
  onClose 
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const { removeItem } = useClothingStore();
  const { showToast } = useToast();

  // Deletes the garment, then closes; on failure shows an error toast and keeps the dialog open.
  const handleDelete = async () => {
    if (itemId === null) return;
    
    setIsDeleting(true);
    try {
      await removeItem(itemId);
      showToast(`Garment "${itemName}" deleted`, 'success');
      onClose();
    } catch (error) {
      console.error('Failed to delete item:', error);
      showToast('Failed to delete garment', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} className="max-w-md bg-background-secondary border border-rose-500/20 rounded-xl shadow-lg" backdropClassName="bg-background-main/90 backdrop-blur-sm">
            <div className="p-8 text-center">
              <div className="w-20 h-20 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-6 text-rose-500">
                <AlertTriangle size={40} />
              </div>
              
              <h2 className="text-2xl font-light tracking-tight text-text-primary mb-2">Delete Garment?</h2>
              <p className="text-text-secondary text-sm leading-relaxed mb-8">
                Are you sure you want to remove <span className="text-text-primary font-bold">"{itemName}"</span>? This action is permanent and cannot be undone.
              </p>

              <div className="flex flex-col gap-3">
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="w-full py-4 bg-rose-500 hover:bg-rose-600 text-white text-xs font-medium uppercase tracking-[0.2em] rounded-full transition-all flex items-center justify-center gap-2 shadow-lg shadow-rose-500/20"
                >
                  {isDeleting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    'Confirm Deletion'
                  )}
                </button>
                <button
                  onClick={onClose}
                  disabled={isDeleting}
                  className="w-full py-4 bg-ink/5 hover:bg-ink/10 text-text-secondary hover:text-text-primary text-xs font-medium uppercase tracking-[0.2em] rounded-full transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>

            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 text-text-secondary hover:text-text-primary transition-colors"
            >
              <X size={20} />
            </button>
          </ModalShell>
  );
};

export default DeleteConfirmationModal;
