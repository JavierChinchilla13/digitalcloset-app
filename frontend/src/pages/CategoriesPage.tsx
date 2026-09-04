import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft, Plus, Loader2, Tag, Trash2, Pencil, Check, X, Search,
} from 'lucide-react';
import { useCollectionStore } from '../store/useCollectionStore';
import { useToast } from '../components/Toast';
import SectionWrapper from '../components/SectionWrapper';
import type { Collection } from '../types';

// Categories management page (Task 49, Phase 9; refined in the Phase 9
// follow-up). Create/rename/delete a Collection (Task 48) and search the
// list - viewing/editing a category's contents now lives at its own
// /categories/:id detail route (CategoryDetailPage) rather than an inline
// expand here, so a category card's job is purely list-level: name, counts,
// rename, delete, and a click-through to the detail page.
const CategoriesPage = () => {
  const navigate = useNavigate();
  const {
    collections, fetchCollections, createCollection,
    renameCollection, deleteCollection,
  } = useCollectionStore();
  const { showToast } = useToast();

  const [showContent, setShowContent] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Create-category form (Phase 9 follow-up, point 2): a same-slot toggle
  // between the "Create" button and an inline name input + confirm/cancel,
  // rather than a modal. Flagged choice: this exact pattern (click to swap
  // a button for a small input+check+x row) is already established twice
  // in this codebase - CollectionCard's own rename control below, and
  // CategoryPicker's "+ New Category" sub-row - so it's the more
  // consistent option than introducing a third, modal-based way to do the
  // same "type one name, confirm/cancel" interaction.
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');
  // Snapshotted at request time (not re-derived from `collections` via a
  // live .find()) - deleteCollection removes the row from that array
  // before this state clears, which would otherwise flash the modal's
  // copy to an empty name for one render.
  const [pendingDelete, setPendingDelete] = useState<{ id: number; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchCollections().finally(() => setShowContent(true));
  }, [fetchCollections]);

  // Client-side, case-insensitive substring match - the full list is
  // already fetched once above, not re-fetched per keystroke.
  const filteredCollections = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return collections;
    return collections.filter((c) => c.name.toLowerCase().includes(query));
  }, [collections, searchQuery]);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    setIsCreating(true);
    try {
      await createCollection(name);
      setNewName('');
      setShowCreateForm(false);
      showToast(`Category "${name}" created`, 'success');
    } catch {
      showToast('Failed to create category', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const cancelCreate = () => {
    setShowCreateForm(false);
    setNewName('');
  };

  const startRename = (c: Collection) => {
    setRenamingId(c.collectionId);
    setRenameValue(c.name);
  };

  const confirmRename = async () => {
    if (renamingId == null) return;
    const name = renameValue.trim();
    if (!name) return;
    await renameCollection(renamingId, name);
    setRenamingId(null);
  };

  const confirmDelete = async () => {
    if (pendingDelete == null) return;
    setIsDeleting(true);
    try {
      await deleteCollection(pendingDelete.id);
      showToast(`Category "${pendingDelete.name}" deleted`, 'success');
      setPendingDelete(null);
    } catch {
      showToast('Failed to delete category', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background-main pt-24 pb-20">
      <SectionWrapper>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8 mb-10">
          <div className="space-y-4">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 text-text-secondary hover:text-white transition-colors text-[10px] font-black uppercase tracking-widest"
            >
              <ChevronLeft size={14} />
              Back to Attire
            </button>
            <h1 className="text-6xl font-light tracking-tighter text-white uppercase leading-none">
              MY <br /> <span className="text-accent">CATEGORIES</span>
            </h1>
            <p className="text-text-secondary text-xs font-medium max-w-md uppercase tracking-widest opacity-40">
              Organize your closet // {collections.length} {collections.length === 1 ? 'category' : 'categories'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {showCreateForm ? (
              <>
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreate();
                    if (e.key === 'Escape') cancelCreate();
                  }}
                  placeholder="CATEGORY NAME"
                  className="bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white text-[10px] font-black tracking-widest uppercase placeholder:text-white/20 focus:outline-none focus:border-accent/50 transition-all w-56"
                />
                <button
                  onClick={handleCreate}
                  disabled={isCreating || !newName.trim()}
                  className="p-4 rounded-2xl bg-accent/10 hover:bg-accent/20 text-accent transition-all disabled:opacity-30 disabled:pointer-events-none"
                  title="Confirm"
                >
                  {isCreating ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                </button>
                <button
                  onClick={cancelCreate}
                  disabled={isCreating}
                  className="p-4 rounded-2xl hover:bg-white/5 text-text-secondary hover:text-white transition-all"
                  title="Cancel"
                >
                  <X size={18} />
                </button>
              </>
            ) : (
              <button
                onClick={() => setShowCreateForm(true)}
                className="group px-8 py-4 bg-white text-background-main font-black rounded-2xl flex items-center gap-3 transition-all hover:scale-105 active:scale-95 shadow-2xl shadow-white/5"
              >
                <Plus size={18} className="group-hover:rotate-90 transition-transform duration-500" />
                <span className="text-[10px] tracking-[0.2em] uppercase">Create</span>
              </button>
            )}
          </div>
        </div>

        <div className="relative mb-16 max-w-sm">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-text-secondary" size={14} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="SEARCH CATEGORIES..."
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white text-[9px] font-black tracking-widest uppercase placeholder:text-white/20 focus:outline-none focus:border-accent/50 transition-all"
          />
        </div>

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
              <p className="text-[8px] font-black tracking-[0.4em] text-white uppercase opacity-20">Synchronizing...</p>
            </motion.div>
          ) : collections.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="py-32 flex flex-col items-center justify-center text-center border-2 border-dashed border-white/5 rounded-[3rem] bg-white/[0.01]"
            >
              <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mb-8 opacity-20">
                <Tag size={40} className="text-text-secondary" />
              </div>
              <h3 className="text-xl font-light text-white tracking-[0.3em] uppercase mb-4">No categories yet</h3>
              <p className="text-text-secondary text-[10px] font-black tracking-widest uppercase mb-4 opacity-30">
                Create one above to start organizing your closet
              </p>
            </motion.div>
          ) : filteredCollections.length === 0 ? (
            <motion.div
              key="no-matches"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="py-32 flex flex-col items-center justify-center text-center border-2 border-dashed border-white/5 rounded-[3rem] bg-white/[0.01]"
            >
              <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mb-8 opacity-20">
                <Search size={40} className="text-text-secondary" />
              </div>
              <h3 className="text-xl font-light text-white tracking-[0.3em] uppercase mb-4">No matches</h3>
              <p className="text-text-secondary text-[10px] font-black tracking-widest uppercase mb-4 opacity-30">
                No categories match "{searchQuery}"
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8"
            >
              {filteredCollections.map((c) => (
                <CollectionCard
                  key={c.collectionId}
                  collection={c}
                  isRenaming={renamingId === c.collectionId}
                  renameValue={renameValue}
                  onRenameValueChange={setRenameValue}
                  onStartRename={() => startRename(c)}
                  onConfirmRename={confirmRename}
                  onCancelRename={() => setRenamingId(null)}
                  onRequestDelete={() => setPendingDelete({ id: c.collectionId, name: c.name })}
                  onOpenDetail={() => navigate(`/categories/${c.collectionId}`)}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </SectionWrapper>

      <AnimatePresence>
        {pendingDelete != null && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPendingDelete(null)}
              className="absolute inset-0 bg-background-main/90 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-background-secondary border border-rose-500/20 rounded-[2rem] shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-8 text-center">
                <div className="w-20 h-20 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-6 text-rose-500">
                  <Trash2 size={40} />
                </div>
                <h2 className="text-2xl font-light tracking-tight text-white mb-2">Delete Category?</h2>
                <p className="text-text-secondary text-sm leading-relaxed mb-8">
                  Are you sure you want to remove{' '}
                  <span className="text-white font-bold">"{pendingDelete?.name}"</span>?
                  Its items and outfits stay in your closet - only the category itself is deleted.
                </p>
                <div className="flex flex-col gap-3">
                  <button
                    onClick={confirmDelete}
                    disabled={isDeleting}
                    className="w-full py-4 bg-rose-500 hover:bg-rose-600 text-white text-xs font-black uppercase tracking-[0.2em] rounded-full transition-all flex items-center justify-center gap-2 shadow-lg shadow-rose-500/20"
                  >
                    {isDeleting ? <Loader2 size={16} className="animate-spin" /> : 'Confirm Deletion'}
                  </button>
                  <button
                    onClick={() => setPendingDelete(null)}
                    disabled={isDeleting}
                    className="w-full py-4 bg-white/5 hover:bg-white/10 text-text-secondary hover:text-white text-xs font-black uppercase tracking-[0.2em] rounded-full transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
              <button
                onClick={() => setPendingDelete(null)}
                className="absolute top-4 right-4 p-2 text-text-secondary hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

interface CollectionCardProps {
  collection: Collection;
  isRenaming: boolean;
  renameValue: string;
  onRenameValueChange: (value: string) => void;
  onStartRename: () => void;
  onConfirmRename: () => void;
  onCancelRename: () => void;
  onRequestDelete: () => void;
  onOpenDetail: () => void;
}

const CollectionCard = ({
  collection, isRenaming, renameValue, onRenameValueChange, onStartRename,
  onConfirmRename, onCancelRename, onRequestDelete, onOpenDetail,
}: CollectionCardProps) => {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => !isRenaming && onOpenDetail()}
      className={`rounded-[2rem] border border-white/5 bg-white/[0.02] overflow-hidden transition-colors ${
        isRenaming ? '' : 'cursor-pointer hover:border-white/20'
      }`}
    >
      <div className="p-6 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-grow">
          {isRenaming ? (
            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              <input
                autoFocus
                value={renameValue}
                onChange={(e) => onRenameValueChange(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onConfirmRename()}
                className="min-w-0 flex-grow bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm font-bold focus:outline-none focus:border-accent/50"
              />
              <button onClick={onConfirmRename} className="p-2 rounded-lg bg-accent/10 hover:bg-accent/20 text-accent transition-colors">
                <Check size={14} />
              </button>
              <button onClick={onCancelRename} className="p-2 rounded-lg hover:bg-white/5 text-text-secondary transition-colors">
                <X size={14} />
              </button>
            </div>
          ) : (
            <h3 className="text-lg font-bold text-white truncate">{collection.name}</h3>
          )}
          <p className="text-[9px] font-black text-text-secondary uppercase tracking-widest opacity-50 mt-1">
            {collection.items.length} {collection.items.length === 1 ? 'item' : 'items'} · {collection.outfits.length} {collection.outfits.length === 1 ? 'outfit' : 'outfits'}
          </p>
        </div>
        {!isRenaming && (
          <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            <button onClick={onStartRename} className="p-2 rounded-lg hover:bg-white/5 text-text-secondary hover:text-white transition-colors" title="Rename">
              <Pencil size={14} />
            </button>
            <button onClick={onRequestDelete} className="p-2 rounded-lg hover:bg-rose-500/10 text-text-secondary hover:text-rose-400 transition-colors" title="Delete">
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default CategoriesPage;
