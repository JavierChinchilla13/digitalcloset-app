import { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, Search, Loader2, X, Shirt, RotateCcw, Save, User, LayoutGrid } from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useClothingStore } from '../store/useClothingStore';
import { usePersonaStore } from '../store/usePersonaStore';
import { useOutfitStore, equippedFromOutfitItems } from '../store/useOutfitStore';
import { useOutfitDraftStore, outfitItemsFromDraft, draftFromOutfitItems } from '../store/useOutfitDraftStore';
import { groupSelectedItemsForDisplay, pairShoesForDisplay } from '../utils/selectionDisplay';
import { ClothingCategory, PersonaStatus } from '../types';
import type { OutfitRequest, OutfitItem, PersonaState, ClothingItem } from '../types';
import PersonaRenderer from '../components/PersonaRenderer';
import EditClothingModal from '../components/EditClothingModal';
import { useToast } from '../components/Toast';

// Item-first outfit builder (Task 36-38, Phase 8 pivot): browse the closet
// and multi-select items with zero fitting or persona involvement, using
// useOutfitDraftStore's flat selectedItemIds, then save/update it as a
// backend outfit via outfitItemsFromDraft.
//
// Deliberately does NOT filter the browse grid by persona type the way
// ClosetPage/OutfitBuilderPage do - restricting selection to one persona
// type here would misrepresent the item-first pivot's own premise (an
// outfit should be assemblable from any of the user's items). Each card
// shows its persona type as a small badge instead, so mixed selections stay
// legible. This makes a call on open question #7 (mixed-persona outfits)
// for the *selection* UI specifically. The optional persona preview
// (Task 38) is where that tradeoff becomes visible: it can only ever show
// FITTED items matching one persona type (reusing PersonaRenderer/
// equippedFromOutfitItems unchanged), so anything else in the selection is
// called out by count rather than silently dropped.
function formatCategoryLabel(category: ClothingCategory): string {
  return category.charAt(0) + category.slice(1).toLowerCase();
}

// Denser card for the "Your Selection" panel (Task 43) - smaller than the
// browse grid's cards, same hover-to-reveal remove affordance as before.
const SelectionCard = ({ item, onRemove }: { item: ClothingItem; onRemove: (itemId: number) => void }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    className="relative aspect-[4/5] rounded-xl overflow-hidden border border-accent/30 group"
  >
    <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
    <button
      onClick={() => onRemove(item.itemId)}
      className="absolute top-1.5 right-1.5 p-1 bg-black/60 hover:bg-red-500/80 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
      title="Remove"
    >
      <X size={10} />
    </button>
    <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-gradient-to-t from-black/80 to-transparent">
      <p className="text-[6px] font-bold text-white line-clamp-1 uppercase tracking-wider">{item.name}</p>
    </div>
  </motion.div>
);

// Shoes get their own 2-up sub-row (left/right paired via
// pairShoesForDisplay) instead of the generic grid; any unpaired items (no
// recorded side, or an extra pair) fall back to the same denser grid used
// elsewhere, in a secondary row underneath - mirrors the simplification
// documented on pairShoesForDisplay itself.
const ShoeSubRow = ({ items, onRemove }: { items: ClothingItem[]; onRemove: (itemId: number) => void }) => {
  const { left, right, unpaired } = pairShoesForDisplay(items);
  return (
    <div className="space-y-3">
      {(left || right) && (
        <div className="grid grid-cols-2 gap-4 max-w-[220px]">
          {left && <SelectionCard item={left} onRemove={onRemove} />}
          {right && <SelectionCard item={right} onRemove={onRemove} />}
        </div>
      )}
      {unpaired.length > 0 && (
        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-4">
          {unpaired.map((item) => (
            <SelectionCard key={item.itemId} item={item} onRemove={onRemove} />
          ))}
        </div>
      )}
    </div>
  );
};

const FlatOutfitBuilderPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  // Task 41: this page also renders at "/" itself (Task 39's post-login
  // landing) - a back button there would point "back" to a page that isn't
  // where the user came from, so it's hidden specifically on that route.
  // On /outfits/flat/new and /outfits/flat/edit/:id, "back to outfits" is
  // still the correct affordance.
  const { pathname } = useLocation();
  const isLandingRoute = pathname === '/';
  const { items, isLoading, fetchItems, markItemAsFitted } = useClothingStore();
  // Read-only: only used as the outfit's avatarType default (open question
  // #6's recommendation - the backend's Outfit.avatarType is NOT NULL and
  // this page has no single persona type of its own to draw from). Never
  // mutated here - the persona equip semantics stay untouched.
  const { persona } = usePersonaStore();
  const { outfits, fetchOutfits, saveOutfit, updateOutfit } = useOutfitStore();
  const { selectedItemIds, toggleItem, removeItem, clearDraft, setDraft } = useOutfitDraftStore();
  const { showToast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [outfitName, setOutfitName] = useState('New Style');
  const [isSaving, setIsSaving] = useState(false);
  const [outfitsReady, setOutfitsReady] = useState(false);

  useEffect(() => {
    fetchItems();
    fetchOutfits().finally(() => setOutfitsReady(true));
  }, [fetchItems, fetchOutfits]);

  // Editing an existing outfit: load its saved selection into the draft
  // store once outfits have loaded. Mirrors OutfitBuilderPage's equivalent
  // effect, using draftFromOutfitItems instead of equippedFromOutfitItems.
  useEffect(() => {
    if (!outfitsReady || !id) return;
    const existing = outfits.find((o) => String(o.outfitId) === id);
    if (existing) {
      setOutfitName(existing.name);
      setDraft(draftFromOutfitItems(existing.items));
    }
  }, [id, outfits, outfitsReady, setDraft]);

  const handleSave = async () => {
    setIsSaving(true);

    const outfitData: OutfitRequest = {
      name: outfitName,
      avatarType: persona.type,
      items: outfitItemsFromDraft(selectedItemIds, items),
    };

    try {
      if (id) {
        await updateOutfit(Number(id), outfitData);
      } else {
        await saveOutfit(outfitData);
      }
      clearDraft();
      navigate('/outfits');
    } finally {
      setIsSaving(false);
    }
  };

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
      .map((itemId) => items.find((item) => item.itemId === itemId))
      .filter((item): item is NonNullable<typeof item> => !!item),
    [selectedItemIds, items]
  );

  // Selection panel grouping (Task 43): buckets selectedItems into
  // SELECTION_DISPLAY_ORDER sub-groups, accessories separated out
  // entirely - reuses Task 42's pure helpers, no grouping logic of its own.
  const groupedSelection = useMemo(() => groupSelectedItemsForDisplay(selectedItems), [selectedItems]);
  const accessoryItems = useMemo(
    () => selectedItems.filter((item) => item.category === ClothingCategory.ACCESSORY),
    [selectedItems]
  );

  const [showPersonaPreview, setShowPersonaPreview] = useState(false);

  // Task 45: "Adjust & Fit" entry point - opens EditClothingModal's Fabric
  // Studio for a specific excluded item, with promoteToFittedOnSave so a
  // saved adjustment also flips it to FITTED.
  const [fitModalItem, setFitModalItem] = useState<ClothingItem | null>(null);

  // Task 46: the exclusion note's per-item actions split by reason - the
  // "ineligible" bucket below (Task 38) counts both together, but only
  // NOT_FITTED items can be fitted (Mark as Fitted / Adjust & Fit);
  // INELIGIBLE_NO_CUTOUT items have no cutout to fit at all (open question
  // #14, still open) and only offer removing them from the selection.
  const notFittedExcluded = useMemo(
    () => selectedItems.filter((item) => item.personaStatus === PersonaStatus.NOT_FITTED),
    [selectedItems]
  );
  const noCutoutExcluded = useMemo(
    () => selectedItems.filter((item) => item.personaStatus === PersonaStatus.INELIGIBLE_NO_CUTOUT),
    [selectedItems]
  );

  // Persona preview (Task 38): filters the flat selection down to what
  // PersonaRenderer can actually show - FITTED items (a NOT_FITTED/
  // INELIGIBLE_NO_CUTOUT item has no fitted transform to render) matching
  // the preview persona's type (PersonaRenderer's own getItem already drops
  // a type mismatch silently; both exclusion reasons are counted here so
  // the UI can say so instead of just quietly showing fewer items than were
  // selected - the concrete, visible form of open question #7's tradeoff).
  // Reuses equippedFromOutfitItems (Task 16) and PersonaRenderer unchanged -
  // no rendering logic is touched by this task.
  const { previewPersona, excludedIneligibleCount, excludedWrongPersonaCount } = useMemo(() => {
    const ineligible = selectedItems.filter(
      (item) => item.personaStatus != null && item.personaStatus !== PersonaStatus.FITTED
    );
    const wrongPersona = selectedItems.filter(
      (item) => (item.personaStatus == null || item.personaStatus === PersonaStatus.FITTED)
        && item.personaType !== persona.type
    );
    const eligibleIds = selectedItems
      .filter((item) => (item.personaStatus == null || item.personaStatus === PersonaStatus.FITTED)
        && item.personaType === persona.type)
      .map((item) => item.itemId);

    // outfitItemsFromDraft's output has no outfitItemId (OutfitRequest's
    // create-payload shape); equippedFromOutfitItems expects OutfitItem
    // (the response shape, which does). outfitItemId is never read by
    // equippedFromOutfitItems, so itemId is a safe, harmless placeholder.
    const eligibleOutfitItems: OutfitItem[] = outfitItemsFromDraft(eligibleIds, items).map((oi) => ({
      outfitItemId: oi.itemId,
      itemId: oi.itemId,
      slot: oi.slot,
      itemOrder: oi.itemOrder,
    }));

    const preview: PersonaState = {
      type: persona.type,
      ...equippedFromOutfitItems(eligibleOutfitItems),
    };

    return {
      previewPersona: preview,
      excludedIneligibleCount: ineligible.length,
      excludedWrongPersonaCount: wrongPersona.length,
    };
  }, [selectedItems, items, persona.type]);

  // Task 46: fires a toast every time preview is switched on while
  // exclusions exist (open question #19 - no dismissal/seen-it state to
  // track, so toggling off and back on re-fires it). Intentionally keyed
  // only on showPersonaPreview, not the counts - this is a "just turned on"
  // notification, not a live-updating one; the persistent inline note below
  // is what stays accurate as the selection changes while already open.
  useEffect(() => {
    if (!showPersonaPreview) return;
    const totalExcluded = excludedIneligibleCount + excludedWrongPersonaCount;
    if (totalExcluded > 0) {
      showToast(`${totalExcluded} ${totalExcluded === 1 ? 'item' : 'items'} can't be shown on persona`, 'info');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPersonaPreview]);

  if (!outfitsReady) {
    return (
      <div className="min-h-screen bg-background-main flex items-center justify-center">
        <Loader2 className="animate-spin text-accent" size={40} />
      </div>
    );
  }

  return (
    <div className="h-screen bg-background-main flex flex-col overflow-hidden pt-16">
      <header className="px-8 py-6 border-b border-white/5 bg-background-secondary/20 flex items-center justify-between z-20">
        <div className="flex items-center gap-6">
          {!isLandingRoute && (
            <button
              onClick={() => navigate('/outfits')}
              className="p-3 hover:bg-white/5 rounded-xl text-text-secondary transition-colors border border-white/5"
            >
              <ChevronLeft size={20} />
            </button>
          )}
          <div className="space-y-1">
            <input
              value={outfitName}
              onChange={(e) => setOutfitName(e.target.value)}
              className="bg-transparent text-xl font-light text-white tracking-widest uppercase focus:outline-none border-b border-transparent focus:border-accent/50 transition-all"
              placeholder="ENTER STYLE NAME"
            />
            <p className="text-[8px] font-black text-accent tracking-[0.4em] uppercase">
              {selectedItemIds.length} {selectedItemIds.length === 1 ? 'Item' : 'Items'} Selected
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={clearDraft}
            disabled={selectedItemIds.length === 0}
            className="p-3 hover:bg-white/5 rounded-xl text-text-secondary hover:text-white transition-colors border border-white/5 disabled:opacity-20 disabled:pointer-events-none"
            title="Clear Selection"
          >
            <RotateCcw size={18} />
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || selectedItemIds.length === 0}
            className="px-8 py-3 bg-white text-background-main font-black text-[10px] rounded-xl flex items-center gap-3 transition-all hover:scale-105 active:scale-95 shadow-2xl shadow-white/5 tracking-[0.2em] disabled:opacity-30 disabled:pointer-events-none"
          >
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {id ? 'UPDATE STYLE' : 'SAVE TO COLLECTION'}
          </button>
        </div>
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
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-[10px] font-black text-white tracking-[0.3em] uppercase opacity-50">
                {showPersonaPreview ? 'Persona Preview' : 'Your Selection'}
              </h3>
              <button
                onClick={() => setShowPersonaPreview((v) => !v)}
                disabled={selectedItems.length === 0}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all border border-white/5 bg-white/[0.02] text-text-secondary hover:text-white hover:border-white/20 disabled:opacity-20 disabled:pointer-events-none"
              >
                {showPersonaPreview ? <LayoutGrid size={12} /> : <User size={12} />}
                {showPersonaPreview ? 'List View' : 'Preview On Persona'}
              </button>
            </div>

            {selectedItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-32 gap-4 opacity-20 text-center">
                <Shirt size={40} className="text-text-secondary" />
                <p className="text-[9px] font-black uppercase tracking-widest">
                  Select pieces from the left to build an outfit
                </p>
              </div>
            ) : showPersonaPreview ? (
              <div className="space-y-6">
                {(excludedIneligibleCount > 0 || excludedWrongPersonaCount > 0) && (
                  <div className="px-5 py-4 rounded-2xl bg-white/[0.02] border border-white/5 text-[9px] font-bold text-text-secondary uppercase tracking-widest leading-relaxed">
                    {excludedIneligibleCount > 0 && (
                      <p>{excludedIneligibleCount} {excludedIneligibleCount === 1 ? 'item' : 'items'} hidden — not persona-fitted yet.</p>
                    )}
                    {notFittedExcluded.length > 0 && (
                      <div className="space-y-2 pt-1">
                        {notFittedExcluded.map((item) => (
                          <div key={item.itemId} className="flex items-center gap-2 flex-wrap">
                            <span className="normal-case tracking-normal text-white/60">{item.name}</span>
                            <button
                              onClick={() => markItemAsFitted(item.itemId)}
                              className="px-3 py-1.5 rounded-full bg-accent/10 hover:bg-accent/20 text-accent text-[8px] font-black uppercase tracking-widest transition-colors"
                            >
                              Mark as Fitted
                            </button>
                            <button
                              onClick={() => setFitModalItem(item)}
                              className="px-3 py-1.5 rounded-full bg-accent/10 hover:bg-accent/20 text-accent text-[8px] font-black uppercase tracking-widest transition-colors"
                            >
                              Adjust &amp; Fit
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    {noCutoutExcluded.length > 0 && (
                      <div className="space-y-2 pt-1">
                        {noCutoutExcluded.map((item) => (
                          <div key={item.itemId} className="flex items-center gap-2 flex-wrap">
                            <span className="normal-case tracking-normal text-white/60">{item.name}</span>
                            <button
                              onClick={() => removeItem(item.itemId)}
                              className="px-3 py-1.5 rounded-full bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-[8px] font-black uppercase tracking-widest transition-colors"
                            >
                              Remove From Outfit
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    {excludedWrongPersonaCount > 0 && (
                      <p>{excludedWrongPersonaCount} {excludedWrongPersonaCount === 1 ? 'item' : 'items'} hidden — for the other persona ({persona.type === 'MALE' ? 'FEMALE' : 'MALE'}).</p>
                    )}
                  </div>
                )}
                <div className="w-full h-[50vh]">
                  <PersonaRenderer persona={previewPersona} />
                </div>
              </div>
            ) : (
              <div className="space-y-8">
                {groupedSelection.map((group) => (
                  <div key={group.category} className="space-y-3">
                    <p className="text-[8px] font-black text-text-secondary uppercase tracking-[0.3em] opacity-60">
                      {formatCategoryLabel(group.category)}
                    </p>
                    {group.category === ClothingCategory.SHOES ? (
                      <ShoeSubRow items={group.items} onRemove={removeItem} />
                    ) : (
                      <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-4">
                        {group.items.map((item) => (
                          <SelectionCard key={item.itemId} item={item} onRemove={removeItem} />
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {accessoryItems.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-[8px] font-black text-text-secondary uppercase tracking-[0.3em] opacity-60">
                      Accessories
                    </p>
                    <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-4">
                      {accessoryItems.map((item) => (
                        <SelectionCard key={item.itemId} item={item} onRemove={removeItem} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      <EditClothingModal
        item={fitModalItem}
        isOpen={!!fitModalItem}
        onClose={() => setFitModalItem(null)}
        promoteToFittedOnSave
      />
    </div>
  );
};

export default FlatOutfitBuilderPage;
