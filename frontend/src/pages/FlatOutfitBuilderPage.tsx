import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, Search, Loader2, X, Shirt, RotateCcw, Save, User, LayoutGrid, ChevronDown } from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useClothingStore } from '../store/useClothingStore';
import { usePersonaStore } from '../store/usePersonaStore';
import { useOutfitStore } from '../store/useOutfitStore';
import { useOutfitDraftStore, outfitItemsFromDraft, draftFromOutfitItems } from '../store/useOutfitDraftStore';
import { useCollectionStore } from '../store/useCollectionStore';
import { pairShoesForDisplay } from '../utils/selectionDisplay';
import { computePersonaEligibility } from '../utils/personaEligibility';
import { ClothingCategory } from '../types';
import type { OutfitRequest, ClothingItem } from '../types';
import PersonaRenderer from '../components/PersonaRenderer';
import EditClothingModal from '../components/EditClothingModal';
import CroppedThumbnail from '../components/CroppedThumbnail';
import CategoryPicker from '../components/CategoryPicker';
import ClothingCategoryFilter from '../components/ClothingCategoryFilter';
import PersonaTypeSwitcher, { type PersonaFilterValue } from '../components/PersonaTypeSwitcher';
import { useToast } from '../components/Toast';
import { useSafeAction } from '../hooks/useSafeAction';
import ErrorState from '../components/ErrorState';
import PersonaBadge from '../components/PersonaBadge';

// Item-first outfit builder (Task 36-38, Phase 8 pivot): browse the closet
// and multi-select items with zero fitting or persona involvement, using
// useOutfitDraftStore's flat selectedItemIds, then save/update it as a
// backend outfit via outfitItemsFromDraft.
//
// Originally deliberately did NOT filter the browse grid by persona type
// the way ClosetPage/OutfitBuilderPage do, on the reasoning that an
// outfit should be assemblable from any of the user's items (open
// question #7's resolution for the *selection* UI specifically) - each
// card just showed its persona type as a badge instead, so mixed
// selections stayed legible. Superseded by explicit follow-up feedback
// (Task 76, second follow-up): the browse grid now DOES filter by the
// PersonaTypeSwitcher's gender ("only garments of that gender should
// appear"), with an "Any" mode as the escape hatch back to the original
// unfiltered behavior. Mixed-persona outfits are still allowed (that
// part of the original call stands) - selecting items of more than one
// gender now surfaces a toast instead of only being noticeable later in
// Persona Preview (which can still only ever render FITTED items
// matching one persona type, unchanged).

// Selection panel card (Task 43). Task 76 follow-up: this used to be
// noticeably smaller/denser than the browse grid's own cards (a 4/5/6-
// column grid of aspect-[4/5] tiles vs. browse's 2-column aspect-[3/4]),
// so the instant an item was selected, the right panel visibly "shrank"
// next to the left one - confirmed as a real, reported bug, not just a
// style preference. Matched to browse's own aspect-[3/4] here.
// Task 76 second follow-up: switched from a CSS-grid layout (fixed
// column count, cards sized by the grid's own track width) to a fixed
// card width here, with the containers below using `flex flex-wrap
// justify-center` instead of `grid`. A grid with more columns than
// selected items packs everything into the left-most tracks and leaves
// the rest of the row visibly empty - reported as items sitting "to the
// side" instead of centered. `flex-wrap` + `justify-center` centers
// however many cards actually exist, in any row, regardless of count.
// Third follow-up: trimmed w-36/w-40 (144/160px) down to w-32/w-36
// (128/144px) as part of the "see the whole outfit without scrolling"
// fix - a modest step down (not back to the old, too-small pre-Task-76
// size), traded off against row count/spacing reductions elsewhere so no
// single change had to carry the whole fix on its own.
const SelectionCard = ({ item, onRemove }: { item: ClothingItem; onRemove: (itemId: number) => void }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    className="relative w-32 sm:w-36 shrink-0 aspect-[3/4] rounded-xl overflow-hidden border border-accent/30 group"
  >
    <CroppedThumbnail imageUrl={item.imageUrl} transform={item.transform} alt={item.name} className="w-full h-full object-cover" />
    <PersonaBadge item={item} compact />
    <button
      onClick={() => onRemove(item.itemId)}
      className="absolute top-1.5 right-1.5 p-1 bg-black/60 hover:bg-red-500/80 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
      title="Remove"
    >
      <X size={10} />
    </button>
    <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-gradient-to-t from-black/80 to-transparent">
      <p className="text-[10px] font-bold text-white line-clamp-1 uppercase tracking-wider">{item.name}</p>
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
    <div className="space-y-1.5">
      {(left || right) && (
        <div className="flex gap-4 justify-center">
          {left && <SelectionCard item={left} onRemove={onRemove} />}
          {right && <SelectionCard item={right} onRemove={onRemove} />}
        </div>
      )}
      {unpaired.length > 0 && (
        <div className="flex flex-wrap gap-4 justify-center">
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
  const { pathname, state: navState } = useLocation();
  const isLandingRoute = pathname === '/';
  const { items, isLoading, error: itemsError, fetchItems, markItemAsFitted } = useClothingStore();
  const runSafely = useSafeAction();
  // Used as the outfit's avatarType default (open question #6's
  // recommendation - the backend's Outfit.avatarType is NOT NULL and this
  // page has no single persona type of its own to draw from) AND drives
  // Persona Preview's eligibility filtering below. Task 76 follow-up:
  // `setPersonaType` is now also exposed here via PersonaTypeSwitcher, so
  // this page can change it directly instead of only through /persona -
  // the persona *equip* state (topIds/bottomIds/etc.) still isn't touched
  // here, only which type it targets.
  const { persona, setPersonaType } = usePersonaStore();
  const { outfits, fetchOutfits, saveOutfit, updateOutfit } = useOutfitStore();
  const { selectedItemIds, toggleItem, removeItem, clearDraft, setDraft } = useOutfitDraftStore();
  const { collections, fetchCollections, createCollection } = useCollectionStore();
  const { showToast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [outfitName, setOutfitName] = useState('New Style');
  const [isSaving, setIsSaving] = useState(false);
  const [outfitsReady, setOutfitsReady] = useState(false);

  // Second follow-up to Task 76: the persona switcher now also filters the
  // browse grid by gender ("only garments of that gender should appear"),
  // with an "Any" mode to see everything again - the page's original
  // "deliberately does NOT filter by persona type" stance (see the file-
  // level comment above) is superseded by this explicit request. "Any"
  // isn't a real `PersonaType`, so this is local state, not the global
  // persona store - starts matching whatever the global persona currently
  // is, a reasonable default, but only Male/Female selections here also
  // update the global store (see handleGenderFilterChange below); "Any"
  // is filter-only and leaves the global persona type (and therefore
  // Persona Preview/the save default) exactly where it was.
  const [genderFilter, setGenderFilter] = useState<PersonaFilterValue>(persona.type);
  const handleGenderFilterChange = (next: PersonaFilterValue) => {
    setGenderFilter(next);
    if (next !== 'ANY') {
      setPersonaType(next);
    }
  };

  // Task 51: which categories (if any) the outfit being SAVED should also
  // be added to. Only meaningful for new outfits (id is unset) - editing an
  // existing outfit's category membership isn't this task's scope.
  // Multi-select (user feedback, 2026-09-03) - an outfit can belong to
  // several categories at once, so the picker isn't limited to one.
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<number[]>([]);
  const [isCreatingCollection, setIsCreatingCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');

  useEffect(() => {
    fetchItems();
    fetchOutfits().finally(() => setOutfitsReady(true));
    fetchCollections();
  }, [fetchItems, fetchOutfits, fetchCollections]);

  const toggleSelectedCollection = (id: number) => {
    setSelectedCollectionIds((prev) => (
      prev.includes(id) ? prev.filter((cid) => cid !== id) : [...prev, id]
    ));
  };

  const handleCreateCollectionInline = async () => {
    const name = newCollectionName.trim();
    if (!name) return;
    const created = await createCollection(name);
    setSelectedCollectionIds((prev) => [...prev, created.collectionId]);
    setNewCollectionName('');
    setIsCreatingCollection(false);
  };

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
        const newOutfit = await saveOutfit(outfitData);
        // Task 51: saveOutfit now returns the created outfit (previously
        // void) specifically so it can be linked to categories here.
        for (const collectionId of selectedCollectionIds) {
          await useCollectionStore.getState().addOutfit(collectionId, newOutfit.outfitId);
        }
      }
      clearDraft();
      navigate('/outfits');
    } catch (err: any) {
      // The outfit store's mutations rethrow on failure (updateOutfit
      // used to swallow its errors - fixed in Task 22 - so an edit that
      // failed to save still cleared the draft and navigated away). A
      // failed save now lands here instead.
      showToast(err.message || 'Failed to save outfit', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = activeCategory === 'ALL' || item.category === activeCategory;
      const matchesGender = genderFilter === 'ANY' || item.personaType === genderFilter;
      return matchesSearch && matchesCategory && matchesGender;
    });
  }, [items, searchQuery, activeCategory, genderFilter]);

  // Task 76: the browse grid used to be one flat, unordered grid of
  // whatever matched the search/category filter. Reorganized into fixed
  // sections - Top (a Dress replaces neither Jacket nor Top, it just
  // comes first in the same flowing grid, followed by Tops then Jackets),
  // Bottom, Shoes, Accessories last - so scrolling down the column always
  // moves through the same predictable order regardless of what's in the
  // closet. A section with nothing in it (e.g. filtered to one category,
  // or the closet just has none of that type yet) is skipped rather than
  // shown empty.
  const BROWSE_TOP_ORDER = useMemo(() => [ClothingCategory.DRESS, ClothingCategory.TOP, ClothingCategory.JACKET], []);
  const browseSections = useMemo(() => {
    const byCategories = (cats: ClothingCategory[]) =>
      filteredItems
        .filter((item) => cats.includes(item.category))
        .sort((a, b) => cats.indexOf(a.category) - cats.indexOf(b.category));
    return [
      { label: 'Top', items: byCategories(BROWSE_TOP_ORDER) },
      { label: 'Bottom', items: byCategories([ClothingCategory.BOTTOM]) },
      { label: 'Shoes', items: byCategories([ClothingCategory.SHOES]) },
      { label: 'Accessories', items: byCategories([ClothingCategory.ACCESSORY]) },
    ].filter((section) => section.items.length > 0);
  }, [filteredItems, BROWSE_TOP_ORDER]);

  // Scroll-hint affordance (Task 76) - the browse column is narrow enough
  // that Accessories (and often Shoes) sit below the fold once there's a
  // few sections worth of content above them; a subtle bottom fade + a
  // bouncing chevron signals there's more without needing to scroll first
  // to discover it, and both disappear once actually scrolled to the
  // bottom. No existing pattern for this anywhere in the codebase to
  // reuse - built directly off the scroll container's own metrics.
  const browseScrollRef = useRef<HTMLDivElement>(null);
  const [hasMoreBelow, setHasMoreBelow] = useState(false);
  const checkScrollHint = useCallback(() => {
    const el = browseScrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 8;
    setHasMoreBelow(el.scrollHeight > el.clientHeight && !atBottom);
  }, []);
  // Re-check whenever the visible content changes (new items loaded, a
  // filter/search narrows or widens the list) - the scroll position
  // itself doesn't move, but whether there's now more below it can.
  useEffect(() => {
    checkScrollHint();
  }, [browseSections, checkScrollHint]);

  const selectedItems = useMemo(
    () => selectedItemIds
      .map((itemId) => items.find((item) => item.itemId === itemId))
      .filter((item): item is NonNullable<typeof item> => !!item),
    [selectedItemIds, items]
  );

  // Selection panel grouping (Task 43). Second follow-up to Task 76: used
  // to be SELECTION_DISPLAY_ORDER's five separate labeled groups (Jacket,
  // Top, Dress, Bottom, Shoes) - one of the contributors to needing a
  // scroll to see the whole outfit ("make it so I can see all the outfit
  // or at least most of it"). Merged Jacket/Top/Dress into one flowing
  // "Top" row instead, same grouping the browse panel's own
  // `browseSections` already uses (Task 76) - one fewer row, and the two
  // panels now group selections the same way.
  const TOP_MERGE_ORDER = useMemo(() => [ClothingCategory.DRESS, ClothingCategory.TOP, ClothingCategory.JACKET], []);
  const selectionSections = useMemo(() => {
    const byCategories = (cats: ClothingCategory[]) =>
      selectedItems
        .filter((item) => cats.includes(item.category))
        .sort((a, b) => cats.indexOf(a.category) - cats.indexOf(b.category));
    return [
      { label: 'Top', items: byCategories(TOP_MERGE_ORDER) },
      { label: 'Bottom', items: byCategories([ClothingCategory.BOTTOM]) },
    ].filter((section) => section.items.length > 0);
  }, [selectedItems, TOP_MERGE_ORDER]);
  const shoeItems = useMemo(
    () => selectedItems.filter((item) => item.category === ClothingCategory.SHOES),
    [selectedItems]
  );
  const accessoryItems = useMemo(
    () => selectedItems.filter((item) => item.category === ClothingCategory.ACCESSORY),
    [selectedItems]
  );

  // Second follow-up to Task 76: mixed-gender warning. The page still
  // deliberately allows an outfit to contain items of more than one
  // `personaType` (that design call is unchanged - see the file-level
  // comment above) - this just surfaces it, rather than the user
  // noticing only when Persona Preview silently hides half the outfit.
  const selectedPersonaTypes = useMemo(
    () => Array.from(new Set(selectedItems.map((item) => item.personaType))),
    [selectedItems]
  );
  const isMixedPersona = selectedPersonaTypes.length > 1;

  // Opens with the preview already on when arriving from OutfitCard's
  // "Wear Style" (Task 63), which navigates here with this hint in the
  // router state; every other way of reaching this page starts in the
  // selection view as before.
  const [showPersonaPreview, setShowPersonaPreview] = useState<boolean>(
    Boolean((navState as { showPersonaPreview?: boolean } | null)?.showPersonaPreview)
  );

  // Task 45: "Adjust & Fit" entry point - opens EditClothingModal's Fabric
  // Studio for a specific excluded item, with promoteToFittedOnSave so a
  // saved adjustment also flips it to FITTED.
  const [fitModalItem, setFitModalItem] = useState<ClothingItem | null>(null);

  // Persona preview (Task 38) + per-reason exclusion split (Task 46): the
  // filtering itself now lives in utils/personaEligibility (Task 61) so
  // OutfitCard can share it - see that file for the rules. Reuses
  // equippedFromOutfitItems (Task 16) and PersonaRenderer unchanged.
  const eligibility = useMemo(
    () => computePersonaEligibility(selectedItems, items, persona.type),
    [selectedItems, items, persona.type]
  );
  const { previewPersona } = eligibility;
  const notFittedExcluded = eligibility.notFittedItems;
  const noCutoutExcluded = eligibility.noCutoutItems;
  const excludedIneligibleCount = eligibility.ineligibleItems.length;
  const excludedWrongPersonaCount = eligibility.wrongPersonaItems.length;

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

  // Second follow-up to Task 76: "if you have selected for example male
  // have male garments and then switch to female and add female garments
  // it should give you an alert that you are mixing." Keyed on
  // `isMixedPersona` itself (not the selection as a whole) so it fires
  // once right when the outfit newly becomes mixed, not on every
  // selection change afterward while it stays mixed - same "just
  // happened" notification shape as the exclusion toast above. Removing
  // items back down to one type and then mixing again re-fires it, since
  // that's a real false->true transition of the same dependency.
  useEffect(() => {
    if (!isMixedPersona) return;
    const labels = selectedPersonaTypes
      .map((type) => type.charAt(0) + type.slice(1).toLowerCase())
      .join(' and ');
    showToast(`This outfit mixes ${labels} garments`, 'info');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMixedPersona]);

  if (!outfitsReady) {
    return (
      <div className="min-h-screen bg-background-main flex items-center justify-center">
        <Loader2 className="animate-spin text-accent" size={40} />
      </div>
    );
  }

  return (
    <div className="h-screen bg-background-main flex flex-col overflow-hidden pt-16">
      <header className="px-8 py-6 border-b border-ink/5 bg-background-secondary/20 flex items-center justify-between z-20">
        <div className="flex items-center gap-6">
          {!isLandingRoute && (
            <button
              onClick={() => navigate('/outfits')}
              className="p-3 hover:bg-ink/5 rounded-xl text-text-secondary transition-colors border border-ink/5"
            >
              <ChevronLeft size={20} />
            </button>
          )}
          <div className="space-y-1">
            <input
              value={outfitName}
              onChange={(e) => setOutfitName(e.target.value)}
              className="bg-transparent text-xl font-light text-text-primary tracking-widest uppercase focus:outline-none border-b border-transparent focus:border-accent/50 transition-all"
              placeholder="ENTER STYLE NAME"
            />
            <p className="text-[10px] font-medium text-accent tracking-[0.4em] uppercase">
              {selectedItemIds.length} {selectedItemIds.length === 1 ? 'Item' : 'Items'} Selected
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {!id && (
            <CategoryPicker
              collections={collections}
              selectedIds={selectedCollectionIds}
              onToggle={toggleSelectedCollection}
              isCreating={isCreatingCollection}
              onStartCreating={() => setIsCreatingCollection(true)}
              newName={newCollectionName}
              onNewNameChange={setNewCollectionName}
              onConfirmCreate={handleCreateCollectionInline}
              onCancelCreate={() => { setIsCreatingCollection(false); setNewCollectionName(''); }}
            />
          )}
          <button
            onClick={clearDraft}
            disabled={selectedItemIds.length === 0}
            className="p-3 hover:bg-ink/5 rounded-xl text-text-secondary hover:text-text-primary transition-colors border border-ink/5 disabled:opacity-20 disabled:pointer-events-none"
            title="Clear Selection"
          >
            <RotateCcw size={18} />
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || selectedItemIds.length === 0}
            className="px-8 py-3 bg-ink text-background-main font-medium text-[10px] rounded-xl flex items-center gap-3 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-ink/5 tracking-[0.2em] disabled:opacity-30 disabled:pointer-events-none"
          >
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {id ? 'UPDATE STYLE' : 'SAVE TO COLLECTION'}
          </button>
        </div>
      </header>

      <div className="flex-grow flex overflow-hidden">
        {/* Browsable Wardrobe Panel. Task 76: the old separate `w-20`
            category-icon sidebar is gone - the category filter now lives
            directly under the search bar as a single dropdown
            (ClothingCategoryFilter), and the grid below it is grouped into
            fixed Top/Bottom/Shoes/Accessories sections instead of one flat
            unordered grid.
            Real root cause of the reported "everything goes small" bug,
            found while verifying the card-size fix below: this panel had
            an explicit `w-96` but no `shrink-0`, so it was a normal flex
            item with the default `flex-shrink: 1`. Empty, the selection
            panel's content was narrow enough that no shrinking occurred
            (384px rendered as expected) - but the instant it had any grid
            content at all, its flex-basis auto-sizing grew, and the
            browser proportionally shrank BOTH flex children to fit,
            squeezing this panel down to ~148px (measured live) - not just
            the selection panel's own cards being smaller, the entire
            browse column and its cards visibly shrinking too. `shrink-0`
            pins this panel to its intended 384px regardless of what the
            selection panel's content demands - confirmed live by toggling
            it directly in the browser: without it, populated width was
            148px; with it, back to the correct 384px. */}
        <aside className="w-96 shrink-0 border-r border-ink/5 flex flex-col bg-background-secondary/5">
          <div className="p-6 border-b border-ink/5 space-y-4">
            <h3 className="text-[10px] font-medium text-text-primary tracking-[0.3em] uppercase opacity-50">
              Available Pieces
            </h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={14} />
              <input
                type="text"
                placeholder="SEARCH..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-ink/5 border border-ink/10 rounded-xl py-3 pl-9 pr-4 text-text-primary text-[10px] font-medium tracking-widest focus:outline-none focus:border-accent/50 transition-all"
              />
            </div>
            <ClothingCategoryFilter value={activeCategory} onChange={setActiveCategory} />
          </div>
          <div className="relative flex-grow overflow-hidden">
            <div
              ref={browseScrollRef}
              onScroll={checkScrollHint}
              className="h-full overflow-y-auto no-scrollbar p-6 space-y-8"
            >
              {isLoading && items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-20">
                  <Loader2 className="animate-spin text-accent" size={24} />
                  <p className="text-[10px] font-medium uppercase tracking-widest">Syncing Wardrobe...</p>
                </div>
              ) : itemsError && items.length === 0 ? (
                <ErrorState
                  compact
                  title="We couldn't load your closet"
                  message="Check your connection and try again."
                  onRetry={fetchItems}
                />
              ) : browseSections.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-20 text-center">
                  <Shirt size={32} className="text-text-secondary" />
                  <p className="text-[10px] font-medium uppercase tracking-widest">No pieces found</p>
                </div>
              ) : (
                browseSections.map((section) => (
                  <div key={section.label} className="space-y-3">
                    <p className="text-[10px] font-medium text-text-secondary uppercase tracking-[0.3em] opacity-60">
                      {section.label}
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      {section.items.map((item) => {
                        const active = selectedItemIds.includes(item.itemId);
                        return (
                          <motion.div
                            key={item.itemId}
                            whileHover={{ y: -4 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => toggleItem(item.itemId)}
                            className={`
                              relative aspect-[3/4] rounded-2xl overflow-hidden cursor-pointer border transition-all duration-300
                              ${active ? 'border-accent ring-2 ring-accent/20' : 'border-ink/5 hover:border-ink/20'}
                            `}
                          >
                            <CroppedThumbnail imageUrl={item.imageUrl} transform={item.transform} alt={item.name} className="w-full h-full object-cover" />
                            {/* Task 77: was a raw MALE/FEMALE pill; now the shared
                                persona sign (persona name / Not fitted / Unassigned). */}
                            <PersonaBadge item={item} />
                            <div className={`
                              absolute inset-0 bg-accent/20 flex items-center justify-center transition-opacity
                              ${active ? 'opacity-100' : 'opacity-0'}
                            `}>
                              <div className="bg-ink text-accent p-2 rounded-full shadow-md">
                                <X size={16} className="rotate-45" />
                              </div>
                            </div>
                            <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
                              <p className="text-[10px] font-bold text-white line-clamp-1 uppercase tracking-wider">{item.name}</p>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Scroll-hint affordance (Task 76) - a bottom fade + bouncing
                chevron, shown only while there's more content below the
                fold, so Accessories (and often Shoes) don't go unnoticed
                just because they start below the visible area. */}
            {hasMoreBelow && (
              <div className="absolute bottom-0 left-0 right-0 h-16 pointer-events-none flex items-end justify-center pb-2 bg-gradient-to-t from-background-secondary/90 to-transparent">
                <motion.div
                  animate={{ y: [0, 4, 0] }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                  className="text-text-secondary opacity-60"
                >
                  <ChevronDown size={16} />
                </motion.div>
              </div>
            )}
          </div>
        </aside>

        {/* Right Panel: Current Selection (no persona rendering) */}
        <main className="flex-grow relative bg-background-main overflow-y-auto no-scrollbar p-6">
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(#5B8CFF 1px, transparent 1px)',
              backgroundSize: '40px 40px'
            }}
          />

          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[10px] font-medium text-text-primary tracking-[0.3em] uppercase opacity-50">
                {showPersonaPreview ? 'Persona Preview' : 'Your Selection'}
              </h3>
              <button
                onClick={() => setShowPersonaPreview((v) => !v)}
                disabled={selectedItems.length === 0}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-medium uppercase tracking-widest transition-all border border-ink/5 bg-ink/[0.02] text-text-secondary hover:text-text-primary hover:border-ink/20 disabled:opacity-20 disabled:pointer-events-none"
              >
                {showPersonaPreview ? <LayoutGrid size={12} /> : <User size={12} />}
                {showPersonaPreview ? 'List View' : 'Preview On Persona'}
              </button>
            </div>

            {/* Task 76 follow-up: persona type switcher, directly below the
                Your Selection/Persona Preview header - a dropdown list
                (not a cycle-on-click toggle) so a future third persona
                type is just another list row, not a UI rework. Second
                follow-up: also the browse grid's gender filter now (see
                handleGenderFilterChange) - "Any" mode leaves Persona
                Preview's own eligibility filtering below and the save
                default on whatever the global persona type currently is. */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-[10px] font-medium text-text-secondary uppercase tracking-widest opacity-50">
                Persona
              </span>
              <PersonaTypeSwitcher value={genderFilter} onChange={handleGenderFilterChange} />
            </div>

            {selectedItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-32 gap-4 opacity-20 text-center">
                <Shirt size={40} className="text-text-secondary" />
                <p className="text-[10px] font-medium uppercase tracking-widest">
                  Select pieces from the left to build an outfit
                </p>
              </div>
            ) : showPersonaPreview ? (
              <div className="space-y-6">
                {(excludedIneligibleCount > 0 || excludedWrongPersonaCount > 0) && (
                  <div className="px-5 py-4 rounded-2xl bg-ink/[0.02] border border-ink/5 text-[10px] font-bold text-text-secondary uppercase tracking-widest leading-relaxed">
                    {excludedIneligibleCount > 0 && (
                      <p>{excludedIneligibleCount} {excludedIneligibleCount === 1 ? 'item' : 'items'} hidden — not persona-fitted yet.</p>
                    )}
                    {notFittedExcluded.length > 0 && (
                      <div className="space-y-2 pt-1">
                        {notFittedExcluded.map((item) => (
                          <div key={item.itemId} className="flex items-center gap-2 flex-wrap">
                            <span className="normal-case tracking-normal text-ink/60">{item.name}</span>
                            <button
                              onClick={() => runSafely(() => markItemAsFitted(item.itemId), "Couldn't update this item")}
                              className="px-3 py-1.5 rounded-full bg-accent/10 hover:bg-accent/20 text-accent text-[10px] font-medium uppercase tracking-widest transition-colors"
                            >
                              Mark as Fitted
                            </button>
                            <button
                              onClick={() => setFitModalItem(item)}
                              className="px-3 py-1.5 rounded-full bg-accent/10 hover:bg-accent/20 text-accent text-[10px] font-medium uppercase tracking-widest transition-colors"
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
                            <span className="normal-case tracking-normal text-ink/60">{item.name}</span>
                            <button
                              onClick={() => removeItem(item.itemId)}
                              className="px-3 py-1.5 rounded-full bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-[10px] font-medium uppercase tracking-widest transition-colors"
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
              // Follow-up: "to see the entire outfit I need to scroll... make
              // it so I can see all the outfit or at least most of it" -
              // tightened the vertical rhythm (32px between groups -> 16px,
              // 12px label-to-row gap -> 6px), same tradeoff as the Outfit
              // Showcase page's own scroll fix (Task 75) - and merged
              // Jacket/Top/Dress into one "Top" row (selectionSections,
              // above) instead of three separate ones, matching the browse
              // panel's own grouping - one fewer row on top of the tighter
              // spacing, without shrinking the just-approved card size.
              <div className="space-y-3">
                {selectionSections.map((section) => (
                  <div key={section.label} className="space-y-1.5">
                    <p className="text-[10px] font-medium text-text-secondary uppercase tracking-[0.3em] opacity-60">
                      {section.label}
                    </p>
                    <div className="flex flex-wrap gap-4 justify-center">
                      {section.items.map((item) => (
                        <SelectionCard key={item.itemId} item={item} onRemove={removeItem} />
                      ))}
                    </div>
                  </div>
                ))}

                {shoeItems.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-medium text-text-secondary uppercase tracking-[0.3em] opacity-60">
                      Shoes
                    </p>
                    <ShoeSubRow items={shoeItems} onRemove={removeItem} />
                  </div>
                )}

                {accessoryItems.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-medium text-text-secondary uppercase tracking-[0.3em] opacity-60">
                      Accessories
                    </p>
                    <div className="flex flex-wrap gap-4 justify-center">
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
