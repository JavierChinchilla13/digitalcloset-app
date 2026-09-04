import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Loader2, Plus, Shirt, LayoutGrid, X, Tag, Check, Search } from 'lucide-react';
import { useCollectionStore } from '../store/useCollectionStore';
import { useClothingStore } from '../store/useClothingStore';
import { useOutfitStore } from '../store/useOutfitStore';
import { useToast } from '../components/Toast';
import SectionWrapper from '../components/SectionWrapper';
import { ClothingCategory, PersonaType } from '../types';
import type { ClothingItem, Collection, Outfit } from '../types';

// Category detail view (Phase 9 follow-up, point 3). Reached from
// CategoriesPage's cards at /categories/:id. Shows one Collection's items
// and outfits, and an "Add to Category" entry point Task 50/51 didn't have
// - until now, an item/outfit could only be linked to a category from the
// upload flow or outfit-save, never after the fact from something already
// in the closet/saved outfits.
const CategoryDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { collections, fetchCollections, removeItem, removeOutfit } = useCollectionStore();
  const { items, fetchItems } = useClothingStore();
  const { fetchOutfits } = useOutfitStore();

  const [isReady, setIsReady] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  useEffect(() => {
    fetchCollections().finally(() => setIsReady(true));
    fetchItems();
    fetchOutfits();
  }, [fetchCollections, fetchItems, fetchOutfits]);

  const collection = collections.find((c) => String(c.collectionId) === id);

  if (!isReady) {
    return (
      <div className="min-h-screen bg-background-main flex items-center justify-center">
        <Loader2 className="animate-spin text-accent" size={40} />
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="min-h-screen bg-background-main pt-24 pb-20">
        <SectionWrapper>
          <div className="py-32 flex flex-col items-center justify-center text-center border-2 border-dashed border-white/5 rounded-[3rem] bg-white/[0.01]">
            <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mb-8 opacity-20">
              <Tag size={40} className="text-text-secondary" />
            </div>
            <h3 className="text-xl font-light text-white tracking-[0.3em] uppercase mb-4">Category not found</h3>
            <button
              onClick={() => navigate('/categories')}
              className="flex items-center gap-2 text-accent hover:text-white transition-colors text-[10px] font-black uppercase tracking-widest"
            >
              <ChevronLeft size={14} />
              Back to Categories
            </button>
          </div>
        </SectionWrapper>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-main pt-24 pb-20">
      <SectionWrapper>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8 mb-16">
          <div className="space-y-4">
            <button
              onClick={() => navigate('/categories')}
              className="flex items-center gap-2 text-text-secondary hover:text-white transition-colors text-[10px] font-black uppercase tracking-widest"
            >
              <ChevronLeft size={14} />
              Back to Categories
            </button>
            <h1 className="text-6xl font-light tracking-tighter text-white uppercase leading-none break-words">
              {collection.name}
            </h1>
            <p className="text-text-secondary text-xs font-medium max-w-md uppercase tracking-widest opacity-40">
              {collection.items.length} {collection.items.length === 1 ? 'item' : 'items'} · {collection.outfits.length} {collection.outfits.length === 1 ? 'outfit' : 'outfits'}
            </p>
          </div>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="group px-8 py-4 bg-white text-background-main font-black rounded-2xl flex items-center gap-3 transition-all hover:scale-105 active:scale-95 shadow-2xl shadow-white/5"
          >
            <Plus size={18} className="group-hover:rotate-90 transition-transform duration-500" />
            <span className="text-[10px] tracking-[0.2em] uppercase">Add to Category</span>
          </button>
        </div>

        {collection.items.length === 0 && collection.outfits.length === 0 ? (
          <div className="py-32 flex flex-col items-center justify-center text-center border-2 border-dashed border-white/5 rounded-[3rem] bg-white/[0.01]">
            <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mb-8 opacity-20">
              <Shirt size={40} className="text-text-secondary" />
            </div>
            <h3 className="text-xl font-light text-white tracking-[0.3em] uppercase mb-4">Nothing here yet</h3>
            <p className="text-text-secondary text-[10px] font-black tracking-widest uppercase mb-4 opacity-30">
              Add existing items or outfits above, or link one in from the
              upload flow or outfit save
            </p>
          </div>
        ) : (
          <div className="space-y-10">
            {collection.items.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-text-secondary opacity-50">
                  <Shirt size={14} />
                  <span className="text-[10px] font-black uppercase tracking-widest">Items</span>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-4">
                  {collection.items.map((item) => (
                    <div key={item.collectionItemId} className="relative aspect-[4/5] rounded-xl overflow-hidden border border-white/5 group">
                      <img src={item.imageUrl} alt={item.itemName} className="w-full h-full object-cover" />
                      <button
                        onClick={() => removeItem(collection.collectionId, item.itemId)}
                        className="absolute top-1.5 right-1.5 p-1.5 bg-black/60 hover:bg-red-500/80 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Remove from category"
                      >
                        <X size={12} />
                      </button>
                      <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-gradient-to-t from-black/80 to-transparent">
                        <p className="text-[6px] font-bold text-white line-clamp-1 uppercase tracking-wider">{item.itemName}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {collection.outfits.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-text-secondary opacity-50">
                  <LayoutGrid size={14} />
                  <span className="text-[10px] font-black uppercase tracking-widest">Outfits</span>
                </div>
                <div className="flex flex-wrap gap-3">
                  {collection.outfits.map((outfit) => (
                    <div
                      key={outfit.collectionOutfitId}
                      className="flex items-center gap-3 px-4 py-2.5 rounded-full bg-white/5 border border-white/5 text-xs font-bold text-white"
                    >
                      {outfit.outfitName}
                      <button
                        onClick={() => removeOutfit(collection.collectionId, outfit.outfitId)}
                        className="text-text-secondary hover:text-rose-400 transition-colors"
                        title="Remove from category"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </SectionWrapper>

      <AddToCategoryModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        collection={collection}
        items={items}
      />
    </div>
  );
};

interface AddToCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  collection: Collection;
  items: ClothingItem[];
}

// A full modal (matching EditClothingModal/DeleteConfirmationModal's own
// chrome), not CategoryPicker - flagged choice (Task 59): CategoryPicker is
// a single-select dropdown of plain text rows, but this needs a scrollable
// image grid with per-item add state, which would be awkward to force into
// that component. Click-to-add is immediate and one-at-a-time (no staged
// multi-select + batch confirm) - mirrors how selection already works in
// the flat outfit builder's own browse grid, and there's no batch-add
// endpoint on the backend to make a staged batch worth building. The modal
// stays open after each add so several items can be added in one sitting.
//
// Task 59 (Phase 9.5): search + category-type filter + persona-type filter
// + a persona badge per thumbnail, plus the grid itself realigned to
// SelectionCard's compact density pattern (Tasks 42-43).
//
// User feedback (2026-09-03): renamed from AddItemsModal - now tabbed
// between Items and Outfits, since a category can hold either. Each tab
// also lists what's already in the category underneath, with the same
// remove action the main page has, so a user can review/undo without
// closing the modal.
const ADD_ITEMS_CATEGORY_FILTERS: Array<ClothingCategory | 'ALL'> = ['ALL', ...Object.values(ClothingCategory)];
// Not hardcoded to [MALE, FEMALE] - derived from the enum so a future
// third PersonaType value shows up here with no change to this file.
const ADD_ITEMS_PERSONA_FILTERS: Array<PersonaType | 'ALL'> = ['ALL', ...Object.values(PersonaType)];

type AddToCategoryTab = 'ITEMS' | 'OUTFITS';

// Small per-outfit preview (user feedback, 2026-09-03) - a 2x2 collage of
// up to 4 of the outfit's own item images, reusing OutfitCard.tsx's
// established mini-grid pattern rather than inventing a new preview style.
// Outfit.items already carries imageUrl per item (Task 15's simplified
// outfit contract), so this needs no extra store lookups.
const OutfitPreviewThumb = ({ outfit }: { outfit: Outfit }) => {
  const previewItems = outfit.items.slice(0, 4);
  if (previewItems.length === 0) {
    return (
      <div className="w-full h-full bg-black/20 flex items-center justify-center opacity-20">
        <LayoutGrid size={16} className="text-white" />
      </div>
    );
  }
  return (
    <div className="w-full h-full grid grid-cols-2 gap-0.5 bg-black/20">
      {previewItems.map((item, idx) => (
        <div
          key={item.outfitItemId}
          className={`relative overflow-hidden bg-black/30 ${previewItems.length === 1 ? 'col-span-2 row-span-2' : ''}`}
        >
          {item.imageUrl && <img src={item.imageUrl} alt={item.itemName ?? ''} className="w-full h-full object-cover" />}
          {idx === 3 && outfit.items.length > 4 && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <span className="text-white text-[8px] font-black">+{outfit.items.length - 3}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

const AddToCategoryModal = ({ isOpen, onClose, collection, items }: AddToCategoryModalProps) => {
  const { addItem, removeItem, addOutfit, removeOutfit } = useCollectionStore();
  const { outfits } = useOutfitStore();
  const { showToast } = useToast();

  const [tab, setTab] = useState<AddToCategoryTab>('ITEMS');
  const [addingItemId, setAddingItemId] = useState<number | null>(null);
  const [addingOutfitId, setAddingOutfitId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<ClothingCategory | 'ALL'>('ALL');
  const [personaFilter, setPersonaFilter] = useState<PersonaType | 'ALL'>('ALL');

  // Fresh state each time the modal opens, rather than carrying over
  // whatever was left from the last time it was open - this component
  // itself never unmounts (only its `isOpen && ...` content does), so
  // without this a reopened modal would silently keep stale filters/tab.
  useEffect(() => {
    if (isOpen) {
      setTab('ITEMS');
      setSearchQuery('');
      setCategoryFilter('ALL');
      setPersonaFilter('ALL');
    }
  }, [isOpen]);

  const existingItemIds = new Set(collection.items.map((i) => i.itemId));
  const availableItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      if (existingItemIds.has(item.itemId)) return false;
      if (categoryFilter !== 'ALL' && item.category !== categoryFilter) return false;
      if (personaFilter !== 'ALL' && item.personaType !== personaFilter) return false;
      if (query && !item.name.toLowerCase().includes(query)) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, searchQuery, categoryFilter, personaFilter, collection.items]);

  const existingOutfitIds = new Set(collection.outfits.map((o) => o.outfitId));
  const availableOutfits = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return outfits.filter((outfit) => {
      if (existingOutfitIds.has(outfit.outfitId)) return false;
      if (query && !outfit.name.toLowerCase().includes(query)) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outfits, searchQuery, collection.outfits]);

  const handleAddItem = async (itemId: number) => {
    setAddingItemId(itemId);
    try {
      await addItem(collection.collectionId, itemId);
    } catch {
      showToast('Failed to add item to category', 'error');
    } finally {
      setAddingItemId(null);
    }
  };

  const handleAddOutfit = async (outfitId: number) => {
    setAddingOutfitId(outfitId);
    try {
      await addOutfit(collection.collectionId, outfitId);
    } catch {
      showToast('Failed to add outfit to category', 'error');
    } finally {
      setAddingOutfitId(null);
    }
  };

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
            className="relative w-full max-w-3xl max-h-[85vh] bg-background-secondary border border-white/5 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-8 pb-6 border-b border-white/5 flex-shrink-0">
              <div>
                <h2 className="text-2xl font-light tracking-tighter text-white uppercase">Add to Category</h2>
                <p className="text-[10px] text-text-secondary font-black tracking-widest uppercase mt-1 opacity-50">
                  To "{collection.name}"
                </p>
              </div>
              <button onClick={onClose} className="p-3 hover:bg-white/5 rounded-full transition-colors text-text-secondary hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="px-8 pt-5 flex-shrink-0">
              <div className="flex gap-2 p-1 bg-white/[0.02] border border-white/5 rounded-xl w-fit">
                {(['ITEMS', 'OUTFITS'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`px-5 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-colors ${
                      tab === t ? 'bg-accent text-white' : 'text-text-secondary hover:text-white'
                    }`}
                  >
                    {t === 'ITEMS' ? 'Items' : 'Outfits'}
                  </button>
                ))}
              </div>
            </div>

            <div className="px-8 py-5 border-b border-white/5 flex-shrink-0 space-y-4">
              <div className="relative">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-text-secondary" size={14} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={tab === 'ITEMS' ? 'SEARCH ITEMS...' : 'SEARCH OUTFITS...'}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white text-[9px] font-black tracking-widest uppercase placeholder:text-white/20 focus:outline-none focus:border-accent/50 transition-all"
                />
              </div>
              {tab === 'ITEMS' && (
                <>
                  <div className="flex flex-wrap gap-2">
                    {ADD_ITEMS_CATEGORY_FILTERS.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setCategoryFilter(cat)}
                        className={`px-3 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest transition-colors border ${
                          categoryFilter === cat
                            ? 'bg-accent/10 border-accent text-accent'
                            : 'bg-white/[0.02] border-white/5 text-text-secondary hover:border-white/20'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {ADD_ITEMS_PERSONA_FILTERS.map((type) => (
                      <button
                        key={type}
                        onClick={() => setPersonaFilter(type)}
                        className={`px-3 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest transition-colors border ${
                          personaFilter === type
                            ? 'bg-accent/10 border-accent text-accent'
                            : 'bg-white/[0.02] border-white/5 text-text-secondary hover:border-white/20'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="p-8 overflow-y-auto no-scrollbar space-y-10">
              {tab === 'ITEMS' ? (
                <>
                  <div className="space-y-4">
                    {availableItems.length === 0 ? (
                      <div className="py-16 flex flex-col items-center justify-center text-center opacity-40">
                        <Shirt size={32} className="text-text-secondary mb-4" />
                        <p className="text-[9px] font-black uppercase tracking-widest">
                          {items.length === 0
                            ? 'No items in your closet yet'
                            : items.length === existingItemIds.size
                              ? 'Every item is already in this category'
                              : 'No items match these filters'}
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-4">
                        {availableItems.map((item) => {
                          const isAdding = addingItemId === item.itemId;
                          return (
                            <button
                              key={item.itemId}
                              onClick={() => handleAddItem(item.itemId)}
                              disabled={isAdding}
                              className="relative aspect-[4/5] rounded-xl overflow-hidden border border-white/5 hover:border-accent/50 transition-all group disabled:opacity-50"
                            >
                              <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                              <div className="absolute top-1.5 left-1.5 px-2 py-1 rounded-full bg-black/60 backdrop-blur-sm">
                                <span className="text-[6px] font-black text-white uppercase tracking-widest">{item.personaType}</span>
                              </div>
                              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                {isAdding ? (
                                  <Loader2 size={18} className="text-white animate-spin" />
                                ) : (
                                  <div className="bg-accent text-white p-1.5 rounded-full">
                                    <Check size={14} />
                                  </div>
                                )}
                              </div>
                              <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-gradient-to-t from-black/80 to-transparent">
                                <p className="text-[6px] font-bold text-white line-clamp-1 uppercase tracking-wider">{item.name}</p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {collection.items.length > 0 && (
                    <div className="space-y-3 pt-6 border-t border-white/5">
                      <p className="text-[8px] font-black text-text-secondary uppercase tracking-widest opacity-50">
                        Already in this category ({collection.items.length})
                      </p>
                      <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-4">
                        {collection.items.map((item) => (
                          <div key={item.collectionItemId} className="relative aspect-[4/5] rounded-xl overflow-hidden border border-white/5 group">
                            <img src={item.imageUrl} alt={item.itemName} className="w-full h-full object-cover opacity-70" />
                            <button
                              onClick={() => removeItem(collection.collectionId, item.itemId)}
                              className="absolute top-1.5 right-1.5 p-1.5 bg-black/60 hover:bg-red-500/80 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Remove from category"
                            >
                              <X size={12} />
                            </button>
                            <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-gradient-to-t from-black/80 to-transparent">
                              <p className="text-[6px] font-bold text-white line-clamp-1 uppercase tracking-wider">{item.itemName}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="space-y-4">
                    {availableOutfits.length === 0 ? (
                      <div className="py-16 flex flex-col items-center justify-center text-center opacity-40">
                        <LayoutGrid size={32} className="text-text-secondary mb-4" />
                        <p className="text-[9px] font-black uppercase tracking-widest">
                          {outfits.length === 0
                            ? 'No saved outfits yet'
                            : outfits.length === existingOutfitIds.size
                              ? 'Every outfit is already in this category'
                              : 'No outfits match this search'}
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-4">
                        {availableOutfits.map((outfit: Outfit) => {
                          const isAdding = addingOutfitId === outfit.outfitId;
                          return (
                            <button
                              key={outfit.outfitId}
                              onClick={() => handleAddOutfit(outfit.outfitId)}
                              disabled={isAdding}
                              className="relative aspect-[4/5] rounded-xl overflow-hidden border border-white/5 hover:border-accent/50 transition-all group disabled:opacity-50"
                            >
                              <OutfitPreviewThumb outfit={outfit} />
                              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                {isAdding ? (
                                  <Loader2 size={18} className="text-white animate-spin" />
                                ) : (
                                  <div className="bg-accent text-white p-1.5 rounded-full">
                                    <Check size={14} />
                                  </div>
                                )}
                              </div>
                              <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-gradient-to-t from-black/80 to-transparent">
                                <p className="text-[6px] font-bold text-white line-clamp-1 uppercase tracking-wider">{outfit.name}</p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {collection.outfits.length > 0 && (
                    <div className="space-y-3 pt-6 border-t border-white/5">
                      <p className="text-[8px] font-black text-text-secondary uppercase tracking-widest opacity-50">
                        Already in this category ({collection.outfits.length})
                      </p>
                      <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-4">
                        {collection.outfits.map((collectionOutfit) => {
                          // CollectionOutfit is a minimal DTO (id/name only) -
                          // the full Outfit (with items[].imageUrl for the
                          // preview) is cross-referenced from useOutfitStore's
                          // already-fetched list rather than added to the
                          // backend response.
                          const fullOutfit = outfits.find((o) => o.outfitId === collectionOutfit.outfitId);
                          return (
                            <div key={collectionOutfit.collectionOutfitId} className="relative aspect-[4/5] rounded-xl overflow-hidden border border-white/5 group">
                              {fullOutfit ? <OutfitPreviewThumb outfit={fullOutfit} /> : <div className="w-full h-full bg-black/20" />}
                              <button
                                onClick={() => removeOutfit(collection.collectionId, collectionOutfit.outfitId)}
                                className="absolute top-1.5 right-1.5 p-1.5 bg-black/60 hover:bg-red-500/80 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Remove from category"
                              >
                                <X size={12} />
                              </button>
                              <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-gradient-to-t from-black/80 to-transparent">
                                <p className="text-[6px] font-bold text-white line-clamp-1 uppercase tracking-wider">{collectionOutfit.outfitName}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default CategoryDetailPage;
