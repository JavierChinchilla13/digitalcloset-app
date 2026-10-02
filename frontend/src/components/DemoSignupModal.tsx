import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles, X } from 'lucide-react';

interface DemoSignupModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Short reason clause completing "Create a free account {reason}" -
  // e.g. "to save this outfit", "to add your own clothes" - so the same
  // modal explains itself differently depending on what triggered it.
  reason: string;
  // The clip shown at the top. Defaults to the outfit-builder tour; the
  // "View on Persona" button passes the persona-dressing clip instead.
  mediaSrc?: string;
  mediaAlt?: string;
}

// Task 81: the demo's account-required gate. One shared modal (not a
// separate one per gated action) - only its `reason` copy changes, opened
// by DemoPage whenever a visitor tries something the in-memory demo can't
// actually do (save an outfit, add/edit/delete a garment). Shows the same
// real, in-app footage as the landing page (Task 80) rather than describing
// the app in words, so a visitor sees exactly what signing up gets them.
const DemoSignupModal = ({
  isOpen,
  onClose,
  reason,
  mediaSrc = '/marketing/outfit-builder-demo.gif',
  mediaAlt = 'Building an outfit in VYSVI and previewing it on a digital persona',
}: DemoSignupModalProps) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-background-main/90 backdrop-blur-sm"
          />

          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative w-full max-w-lg bg-background-secondary border border-ink/5 rounded-2xl shadow-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="aspect-video w-full bg-background-main">
              <img
                src={mediaSrc}
                alt={mediaAlt}
                className="w-full h-full object-cover"
              />
            </div>

            <div className="p-8">
              <span className="inline-flex items-center gap-2 text-accent text-[10px] font-medium tracking-[0.3em] uppercase mb-4">
                <Sparkles size={12} /> Free to create
              </span>
              <h2 className="text-2xl font-light tracking-tight text-text-primary mb-3">
                Create a free account {reason}
              </h2>
              <p className="text-text-secondary text-sm leading-relaxed mb-8">
                This demo closet is temporary and lives only in your browser - nothing here is saved. Sign up to build your own permanent digital closet, save outfits, and keep everything across visits.
              </p>

              <div className="flex flex-col gap-3">
                <Link
                  to="/signup"
                  className="w-full py-4 bg-accent hover:bg-accent-hover text-on-accent text-xs font-medium uppercase tracking-[0.2em] rounded-full transition-all flex items-center justify-center gap-2"
                >
                  Create Free Account <ArrowRight size={14} />
                </Link>
                <button
                  onClick={onClose}
                  className="w-full py-4 bg-ink/5 hover:bg-ink/10 text-text-secondary hover:text-text-primary text-xs font-medium uppercase tracking-[0.2em] rounded-full transition-all"
                >
                  Keep Exploring The Demo
                </button>
              </div>
            </div>

            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 bg-black/40 hover:bg-black/60 rounded-full text-white transition-colors"
            >
              <X size={20} />
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default DemoSignupModal;
