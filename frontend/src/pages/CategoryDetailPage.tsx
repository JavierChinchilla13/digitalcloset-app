import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Loader2, Plus, Shirt, LayoutGrid, X, Tag, Check } from 'lucide-react';
import { useCollectionStore } from '../store/useCollectionStore';
import { useClothingStore } from '../store/useClothingStore';
import { useToast } from '../components/Toast';
import SectionWrapper from '../components/SectionWrapper';
import type { ClothingItem, Collection } from '../types';

// Category detail view (Phase 9 follow-up, point 3). Reached from
// CategoriesPage's cards at /categories/:id. Shows one Collection's items
// and outfits (moved here from CollectionCard's old inline expand, which
// this route replaces), and adds an "Add Items" entry point Task 50/51
// didn't have - until now, an item could only be linked to a category from
// the upload flow or outfit-save, never after the fact from an existing
// closet item.
const CategoryDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { collections, fetchCollections, removeItem, removeOutfit, addItem } = useCollectionStore();
  const { items, fetchItems } = useClothingStore();
  const { showToast } = useToast();

  const [isReady, setIsReady] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  useEffect(() => {
    fetchCollections().finally(() => setIsReady(true));
    fetchItems();
  }, [fetchCollections, fetchItems]);

  const collection = collections.find((c) => String(c.collectionId) === id);

  const handleAddItem = async (itemId: number) => {
    if (!collection) return;
    try {
      await addItem(collection.collectionId, itemId);
    } catch {
      showToast('Failed to add item to category', 'error');
    }
  };

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
            <span className="text-[10px] tracking-[0.2em] uppercase">Add Items</span>
          </button>
        </div>

        {collection.items.length === 0 && collection.outfits.length === 0 ? (
          <div className="py-32 flex flex-col items-center justify-center text-center border-2 border-dashed border-white/5 rounded-[3rem] bg-white/[0.01]">
            <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mb-8 opacity-20">
              <Shirt size={40} className="text-text-secondary" />
            </div>
            <h3 className="text-xl font-light text-white tracking-[0.3em] uppercase mb-4">Nothing here yet</h3>
            <p className="text-text-secondary text-[10px] font-black tracking-widest uppercase mb-4 opacity-30">
              Add existing items above, or link one in from the upload flow or outfit save
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
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
                  {collection.items.map((item) => (
                    <div key={item.collectionItemId} className="relative aspect-square rounded-2xl overflow-hidden border border-white/5 group">
                      <img src={item.imageUrl} alt={item.itemName} className="w-full h-full object-cover" />
                      <button
                        onClick={() => removeItem(collection.collectionId, item.itemId)}
                        className="absolute top-1.5 right-1.5 p-1.5 bg-black/60 hover:bg-red-500/80 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Remove from category"
                      >
                        <X size={12} />
                      </button>
                      <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                        <p className="text-[7px] font-bold text-white line-clamp-1 uppercase tracking-wider">{item.itemName}</p>
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

      <AddItemsModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        collection={collection}
        items={items}
        onAdd={handleAddItem}
      />
    </div>
  );
};

interface AddItemsModalProps {
  isOpen: boolean;
  onClose: () => void;
  collection: Collection;
  items: ClothingItem[];
  onAdd: (itemId: number) => Promise<void>;
}

// A full modal (matching EditClothingModal/DeleteConfirmationModal's own
// chrome), not CategoryPicker - flagged choice: CategoryPicker is a
// single-select dropdown of plain text rows, but this needs a scrollable
// image grid with per-item add state, which would be awkward to force into
// that component. Click-to-add is immediate and one-at-a-time (no staged
// multi-select + batch confirm) - mirrors how selection already works in
// the flat outfit builder's own browse grid, and there's no batch-add
// endpoint on the backend to make a staged batch worth building. The modal
// stays open after each add so several items can be added in one sitting.
const AddItemsModal = ({ isOpen, onClose, collection, items, onAdd }: AddItemsModalProps) => {
  const [addingId, setAddingId] = useState<number | null>(null);
  const existingIds = new Set(collection.items.map((i) => i.itemId));
  const available = items.filter((item) => !existingIds.has(item.itemId));

  const handleAdd = async (itemId: number) => {
    setAddingId(itemId);
    try {
      await onAdd(itemId);
    } finally {
      setAddingId(null);
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
            className="relative w-full max-w-2xl max-h-[80vh] bg-background-secondary border border-white/5 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-8 border-b border-white/5 flex-shrink-0">
              <div>
                <h2 className="text-2xl font-light tracking-tighter text-white uppercase">Add Items</h2>
                <p className="text-[10px] text-text-secondary font-black tracking-widest uppercase mt-1 opacity-50">
                  To "{collection.name}"
                </p>
              </div>
              <button onClick={onClose} className="p-3 hover:bg-white/5 rounded-full transition-colors text-text-secondary hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="p-8 overflow-y-auto no-scrollbar">
              {available.length === 0 ? (
                <div className="py-16 flex flex-col items-center justify-center text-center opacity-40">
                  <Shirt size={32} className="text-text-secondary mb-4" />
                  <p className="text-[9px] font-black uppercase tracking-widest">
                    {items.length === 0 ? 'No items in your closet yet' : 'Every item is already in this category'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
                  {available.map((item) => {
                    const isAdding = addingId === item.itemId;
                    return (
                      <button
                        key={item.itemId}
                        onClick={() => handleAdd(item.itemId)}
                        disabled={isAdding}
                        className="relative aspect-square rounded-2xl overflow-hidden border border-white/5 hover:border-accent/50 transition-all group disabled:opacity-50"
                      >
                        <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          {isAdding ? (
                            <Loader2 size={20} className="text-white animate-spin" />
                          ) : (
                            <div className="bg-accent text-white p-2 rounded-full">
                              <Check size={16} />
                            </div>
                          )}
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                          <p className="text-[7px] font-bold text-white line-clamp-1 uppercase tracking-wider">{item.name}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default CategoryDetailPage;
