import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '../utils/cn';

interface ModalShellProps {
  isOpen: boolean;
  // Called when the dimmed backdrop is clicked/tapped.
  onClose: () => void;
  // Classes for the card itself: width (`max-w-md`), background, border, radius...
  className?: string;
  // Classes for the dimmed backdrop (its darkness differs a little per modal).
  backdropClassName?: string;
  children: ReactNode;
}

// The dialog frame the app's pop-ups share (Task 91): a dimmed, blurred backdrop and
// a card that scales in. What it adds for phones is that the card can never be taller
// than the visible screen - `100dvh` is the height between the browser's toolbars, not
// the taller `100vh` behind them - and when its content is taller it scrolls inside
// the card instead of being cut off. Everything else (width, colours, radius) stays the
// caller's, passed as `className`.
const ModalShell = ({
  isOpen,
  onClose,
  className,
  backdropClassName = 'bg-background-main/90 backdrop-blur-sm',
  children,
}: ModalShellProps) => (
  <AnimatePresence>
    {isOpen && (
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className={cn('absolute inset-0', backdropClassName)}
        />
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className={cn('relative w-full max-h-[calc(100dvh-1.5rem)] overflow-y-auto', className)}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </motion.div>
      </div>
    )}
  </AnimatePresence>
);

export default ModalShell;
