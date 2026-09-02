import { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, Search, Loader2, X, Shirt, RotateCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useClothingStore } from '../store/useClothingStore';
import { useOutfitDraftStore } from '../store/useOutfitDraftStore';
import { ClothingCategory } from '../types';

// Item-first outfit builder (Task 36, Phase 8 pivot): browse the closet and
// multi-select items with zero fitting or persona involvement, using
// useOutfitDraftStore's flat selectedItemIds. Deliberately no save button
// yet - persisting the draft as a backend outfit is Task 37, matching the
// same narrow-task pattern used for Collection (entity/service before
// controller) and PersonaStatus (entity before DTOs) earlier in this phase.
//
// Deliberately does NOT filter the browse grid by persona type the way
// ClosetPage/OutfitBuilderPage do - restricting selection to one persona
// type here would misrepresent the item-first pivot's own premise (an
// outfit should be assemblable from any of the user's items). Each card
// shows its persona type as a small badge instead, so mixed selections stay
// legible. This makes a call on open question #7 (mixed-persona outfits)
// for the *selection* UI specifically; the persona *preview* (Task 38) can
// still filter to a matching, eligible subset independently.
const FlatOutfitBuilderPage = () => {
  const navigate = useNavigate();
  const { items, isLoading, fetchItems } = useClothingStore();
  const { selectedItemIds, toggleItem, removeItem, clearDraft } = useOutfitDraftStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('ALL');

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const categories = ['ALL', ...Object.values(ClothingCategory)];

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = activeCategory === 'ALL' || item.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [items, searchQuery, activeCategory]);

  const selectedItems = useMemo(
    () => selectedItemIds
      .map((id) => items.find((item) => item.itemId === id))
      .filter((item): item is NonNullable<typeof item> => !!item),
    [selectedItemIds, items]
  );

  return (
    <div className="h-screen bg-background-main flex flex-col overflow-hidden pt-16">
      <header className="px-8 py-6 border-b border-white/5 bg-background-secondary/20 flex items-center justify-between z-20">
        <div className="flex items-center gap-6">
          <button
            onClick={() => navigate('/outfits')}
            className="p-3 hover:bg-white/5 rounded-xl text-text-secondary transition-colors border border-white/5"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="space-y-1">
            <h1 className="text-xl font-light text-white tracking-widest uppercase">Build an Outfit</h1>
            <p className="text-[8px] font-black text-accent tracking-[0.4em] uppercase">
              {selectedItemIds.length} {selectedItemIds.length === 1 ? 'Item' : 'Items'} Selected
            </p>
          </div>
        </div>

        <button
          onClick={clearDraft}
          disabled={selectedItemIds.length === 0}
          className="p-3 hover:bg-white/5 rounded-xl text-text-secondary hover:text-white transition-colors border border-white/5 disabled:opacity-20 disabled:pointer-events-none"
          title="Clear Selection"
        >
          <RotateCcw size={18} />
        </button>
      </header>

      <div className="flex-grow flex overflow-hidden">
        {/* Left Panel: Category Selector */}
        <aside className="w-20 border-r border-white/5 flex flex-col items-center py-8 gap-8 bg-black/20">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`
                relative w-12 h-12 rounded-xl flex items-center justify-center transition-all
                ${activeCategory === cat ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'text-text-secondary hover:text-white hover:bg-white/5'}
              `}
            >
              <div className="text-[8px] font-black rotate-[-90deg] whitespace-nowrap tracking-widest uppercase">
                {cat}
              </div>
              {activeCategory === cat && (
                <motion.div layoutId="activeFlatTab" className="absolute -right-[1px] w-[2px] h-8 bg-accent" />
              )}
            </button>
          ))}
        </aside>

        {/* Center Panel: Browsable Wardrobe Grid */}
        <aside className="w-96 border-r border-white/5 flex flex-col bg-background-secondary/5">
          <div className="p-6 border-b border-white/5 space-y-4">
            <h3 className="text-[10px] font-black text-white tracking-[0.3em] uppercase opacity-50">
              Available Pieces
            </h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={14} />
              <input
                type="text"
                placeholder="SEARCH..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-9 pr-4 text-white text-[9px] font-black tracking-widest focus:outline-none focus:border-accent/50 transition-all"
              />
            </div>
          </div>
          <div className="flex-grow overflow-y-auto no-scrollbar p-6">
            {isLoading && items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-20">
                <Loader2 className="animate-spin text-accent" size={24} />
                <p className="text-[8px] font-black uppercase tracking-widest">Syncing Wardrobe...</p>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-20 text-center">
                <Shirt size={32} className="text-text-secondary" />
                <p className="text-[8px] font-black uppercase tracking-widest">No pieces found</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {filteredItems.map((item) => {
                  const active = selectedItemIds.includes(item.itemId);
                  return (
                    <motion.div
                      key={item.itemId}
                      whileHover={{ y: -4 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => toggleItem(item.itemId)}
                      className={`
                        relative aspect-[3/4] rounded-2xl overflow-hidden cursor-pointer border transition-all duration-300
                        ${active ? 'border-accent ring-2 ring-accent/20' : 'border-white/5 hover:border-white/20'}
                      `}
                    >
                      <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                      <div className="absolute top-2 left-2 px-2 py-1 rounded-full bg-black/60 backdrop-blur-sm">
                        <span className="text-[6px] font-black text-white uppercase tracking-widest">{item.personaType}</span>
                      </div>
                      <div className={`
                        absolute inset-0 bg-accent/20 flex items-center justify-center transition-opacity
                        ${active ? 'opacity-100' : 'opacity-0'}
                      `}>
                        <div className="bg-white text-accent p-2 rounded-full shadow-xl">
                          <X size={16} className="rotate-45" />
                        </div>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
                        <p className="text-[8px] font-bold text-white line-clamp-1 uppercase tracking-wider">{item.name}</p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        {/* Right Panel: Current Selection (no persona rendering) */}
        <main className="flex-grow relative bg-background-main overflow-y-auto no-scrollbar p-8">
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(#5B8CFF 1px, transparent 1px)',
              backgroundSize: '40px 40px'
            }}
          />

          <div className="relative">
            <h3 className="text-[10px] font-black text-white tracking-[0.3em] uppercase opacity-50 mb-8">
              Your Selection
            </h3>

            {selectedItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-32 gap-4 opacity-20 text-center">
                <Shirt size={40} className="text-text-secondary" />
                <p className="text-[9px] font-black uppercase tracking-widest">
                  Select pieces from the left to build an outfit
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-3 md:grid-cols-4 gap-6">
                {selectedItems.map((item) => (
                  <motion.div
                    key={item.itemId}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="relative aspect-[3/4] rounded-2xl overflow-hidden border border-accent/30 group"
                  >
                    <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                    <button
                      onClick={() => removeItem(item.itemId)}
                      className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-red-500/80 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Remove"
                    >
                      <X size={12} />
                    </button>
                    <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                      <p className="text-[7px] font-bold text-white line-clamp-1 uppercase tracking-wider">{item.name}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default FlatOutfitBuilderPage;
