import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, Layers } from 'lucide-react';
import type { ClothingItem } from '../types';

interface ClothingDetailsModalProps {
  item: ClothingItem | null;
  isOpen: boolean;
  onClose: () => void;
}

const ClothingDetailsModal: React.FC<ClothingDetailsModalProps> = ({ item, isOpen, onClose }) => {
  if (!item) return null;

  const formatDate = (dateValue?: any) => {
    // 1. Exhaustive search for the date field in the item object
    const findDate = (val: any) => {
      if (val && typeof val === 'string') return val;
      if (val && Array.isArray(val)) return val;
      
      const obj = item as any;
      return dateValue || obj.uploadDate || obj.createdAt || obj.created_at || obj.date;
    };

    const actualDate = findDate(dateValue);
    
    if (!actualDate) {
      return 'Date not available';
    }
    
    try {
      // 2. Handle array format [yyyy, mm, dd, ...] if sent by Jackson
      if (Array.isArray(actualDate)) {
        const [year, month, day] = actualDate;
        return new Date(year, month - 1, day).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
      }
      
      // 3. Handle string formats
      let dateToParse = actualDate;
      if (typeof actualDate === 'string') {
        // Handle common DB formats: "2026-05-20 21:57:43.629692-06"
        // standard Date() can fail if there's a space instead of T or complex fractional seconds
        dateToParse = actualDate.replace(' ', 'T');
      }

      const date = new Date(dateToParse);
      
      // 4. Final check
      if (isNaN(date.getTime())) {
        // Last ditch effort: try to slice off fractional seconds if it's a messy DB string
        if (typeof actualDate === 'string' && actualDate.includes('.')) {
          const simplified = actualDate.split('.')[0].replace(' ', 'T');
          const date2 = new Date(simplified);
          if (!isNaN(date2.getTime())) {
            return date2.toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            });
          }
        }
        return 'Recently added';
      }
      
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch (e) {
      return 'Processing...';
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-background-main/80 backdrop-blur-md"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-2xl bg-background-secondary border border-white/10 rounded-[2rem] overflow-hidden shadow-2xl shadow-black/50"
          >
            <button
              onClick={onClose}
              className="absolute top-6 right-6 z-10 p-2 bg-black/20 hover:bg-black/40 text-white rounded-full transition-colors backdrop-blur-md"
            >
              <X size={20} />
            </button>

            <div className="flex flex-col md:flex-row h-full">
              {/* Image Section */}
              <div className="md:w-1/2 aspect-[3/4] md:aspect-auto relative overflow-hidden bg-white/5">
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Info Section */}
              <div className="md:w-1/2 p-8 md:p-12 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="px-3 py-1 bg-accent/10 text-accent text-[10px] font-black tracking-widest uppercase rounded-full border border-accent/20">
                      {item.category}
                    </span>
                  </div>
                  
                  <h2 className="text-3xl font-light tracking-tight text-white mb-4">
                    {item.name}
                  </h2>
                  
                  <p className="text-text-secondary text-sm leading-relaxed mb-8">
                    {item.description || "No description provided for this premium garment."}
                  </p>

                  <div className="space-y-4">
                    <div className="flex items-center gap-4 text-xs">
                      <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-text-secondary">
                        <Calendar size={14} />
                      </div>
                      <div>
                        <p className="text-text-secondary/50 font-bold uppercase tracking-tighter text-[8px]">Upload Date</p>
                        <p className="text-white font-medium">{formatDate(item.uploadDate)}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs">
                      <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-text-secondary">
                        <Layers size={14} />
                      </div>
                      <div>
                        <p className="text-text-secondary/50 font-bold uppercase tracking-tighter text-[8px]">Category</p>
                        <p className="text-white font-medium uppercase tracking-widest">{item.category}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-12 pt-8 border-t border-white/5">
                  <p className="text-[10px] text-text-secondary font-black tracking-[0.2em] uppercase opacity-30">
                    Digital Closet Collection 2026
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ClothingDetailsModal;
