import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Sparkles, Shirt, LayoutGrid, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useOutfitStore } from '../store/useOutfitStore';
import { usePersonaStore } from '../store/usePersonaStore';
import OutfitCard from '../components/OutfitCard';
import SectionWrapper from '../components/SectionWrapper';
import ErrorState from '../components/ErrorState';

const SavedOutfitsPage = () => {
  const { outfits, fetchOutfits } = useOutfitStore();
  const [loadFailed, setLoadFailed] = useState(false);
  const { persona } = usePersonaStore();
  const navigate = useNavigate();
  const [showContent, setShowContent] = useState(false);

  // Task 22: the fetch swallows its error into the store, so read it back
  // after each attempt to tell "empty" apart from "couldn't load".
  const loadOutfits = useCallback(async () => {
    setLoadFailed(false);
    await fetchOutfits();
    setLoadFailed(!!useOutfitStore.getState().error);
    setShowContent(true);
  }, [fetchOutfits]);

  const filteredOutfits = outfits.filter(o => o.avatarType === persona.type);

  // Robust content visibility trigger - fetch once, only gate the loader on
  // the first fetch (not on isLoading, which also flips during save/delete).
  useEffect(() => {
    loadOutfits();
  }, [loadOutfits]);

  return (
    <div className="relative min-h-screen pb-20">
      <SectionWrapper className="pt-12">
        {/* Header Section - Always render to avoid complete "blank" screen */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8 mb-16">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-accent" />
              <span className="text-[10px] font-medium tracking-[0.4em] text-accent uppercase">Style Collection</span>
            </div>
            <h1 className="text-6xl font-light tracking-tighter text-text-primary uppercase leading-none">
              SAVED <br /> <span className="text-accent">OUTFITS</span>
            </h1>
            <p className="text-text-secondary text-xs font-medium max-w-md uppercase tracking-widest">
              Your curated digital wardrobe orchestration // {filteredOutfits.length} styles ready
            </p>
          </div>

          <button 
            onClick={() => navigate('/outfits/flat/new')}
            className="group px-10 py-5 bg-ink text-background-main font-medium rounded-xl flex items-center gap-4 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-ink/5"
          >
            <Plus size={20} className="group-hover:rotate-90 transition-transform duration-500" />
            <span className="text-[11px] tracking-[0.2em] uppercase">Initialize New Look</span>
          </button>
        </div>

        {/* Dynamic Content Area */}
        <AnimatePresence mode="wait">
          {!showContent ? (
            <motion.div 
              key="loader"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-32 flex flex-col items-center justify-center text-center"
            >
              <Loader2 className="animate-spin text-accent mb-4" size={40} />
              <p className="text-[10px] font-medium tracking-[0.4em] text-text-primary uppercase opacity-20">Synchronizing...</p>
            </motion.div>
          ) : loadFailed && outfits.length === 0 ? (
            <ErrorState
              key="error"
              title="We couldn't load your outfits"
              message="Check your connection and try again."
              onRetry={loadOutfits}
            />
          ) : filteredOutfits.length === 0 ? (
            <motion.div 
              key="empty"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="py-32 flex flex-col items-center justify-center text-center border-2 border-dashed border-ink/5 rounded-2xl bg-ink/[0.01]"
            >
              <div className="w-24 h-24 rounded-full bg-ink/5 flex items-center justify-center mb-8 opacity-20">
                <Shirt size={40} className="text-text-secondary" />
              </div>
              <h3 className="text-xl font-light text-text-primary tracking-[0.3em] uppercase mb-4">Your collection is empty</h3>
              <p className="text-text-secondary text-[10px] font-medium tracking-widest uppercase mb-12">
                Start orchestrating your first digital style set for this persona
              </p>
              <button 
                onClick={() => navigate('/outfits/flat/new')}
                className="px-10 py-5 border border-ink/10 hover:border-ink/30 text-text-primary font-medium rounded-full flex items-center gap-3 transition-all backdrop-blur-md"
              >
                <LayoutGrid size={18} className="text-text-secondary" />
                <span className="text-[11px] tracking-[0.2em] uppercase">Open Builder</span>
              </button>
            </motion.div>
          ) : (
            <motion.div 
              key="grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-10"
            >
              {/* Inline Add Card */}
              <motion.button
                whileHover={{ y: -8, scale: 0.98 }}
                onClick={() => navigate('/outfits/flat/new')}
                className="aspect-[3/4] rounded-xl border-2 border-dashed border-ink/5 flex flex-col items-center justify-center gap-6 group hover:border-accent/40 hover:bg-accent/5 transition-all"
              >
                <div className="w-16 h-16 rounded-full bg-ink/5 flex items-center justify-center group-hover:bg-accent group-hover:text-on-accent transition-all shadow-md">
                  <Plus size={24} />
                </div>
                <div className="text-center px-4">
                  <span className="text-[10px] font-medium tracking-[0.3em] text-text-secondary group-hover:text-text-primary transition-colors uppercase">
                    ORCHESTRATE <br /> NEW STYLE
                  </span>
                </div>
              </motion.button>

              {filteredOutfits.map((outfit) => (
                <OutfitCard key={outfit.outfitId} outfit={outfit} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </SectionWrapper>
    </div>
  );
};

export default SavedOutfitsPage;
