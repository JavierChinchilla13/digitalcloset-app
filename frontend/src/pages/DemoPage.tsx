import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Shirt, LayoutGrid, Save, Plus, Pencil, Trash2, X, User } from 'lucide-react';
import { useDemoStore } from '../store/useDemoStore';
import { useOutfitDraftStore } from '../store/useOutfitDraftStore';
import { ClothingCategory } from '../types';
import CroppedThumbnail from '../components/CroppedThumbnail';
import ClothingCategoryFilter from '../components/ClothingCategoryFilter';
import DemoSignupModal from '../components/DemoSignupModal';
import { SelectionCard, ShoeSubRow } from '../components/OutfitSelectionCards';
import { toggleWithShoeRule } from '../utils/shoeSelection';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useT, type MessageKey } from '../i18n';

// Task 81: a genuinely-working outfit builder for signed-out visitors,
// mirroring FlatOutfitBuilderPage's browse-grid-left / selection-panel-right
// layout, reading from the in-memory useDemoStore preset closet instead of
// the real one. Free: browsing, filtering, selecting/deselecting, and the
// Closet tab (the inventory view). Gated (opens DemoSignupModal, touches no
// store/API): adding, editing or deleting a garment, and saving the outfit.
//
// There is deliberately no live persona here (preview, switcher, badges):
// dressing the mannequin never looked right for jackets, so it was pulled from
// the demo. "View on Persona" instead opens the sign-up modal with a recorded
// clip of garments being put on the persona (Task 87) - the real thing, one
// account away - and its Create Free Account button.
type GateReason = 'saveOutfit' | 'addClothes' | 'editClothes' | 'deleteClothes' | 'persona';
const PERSONA_GIF = '/marketing/persona-demo.gif';

const SECTIONS: { labelKey: MessageKey; categories: ClothingCategory[] }[] = [
  { labelKey: 'builder.top', categories: [ClothingCategory.DRESS, ClothingCategory.TOP, ClothingCategory.JACKET] },
  { labelKey: 'builder.bottom', categories: [ClothingCategory.BOTTOM] },
  { labelKey: 'builder.shoes', categories: [ClothingCategory.SHOES] },
  { labelKey: 'builder.accessories', categories: [ClothingCategory.ACCESSORY] },
];

const DemoPage = () => {
  const { t } = useT();
  const { items } = useDemoStore();
  const { selectedItemIds, removeItem, clearDraft, setDraft } = useOutfitDraftStore();
  // Task 86: one shoe per foot - choosing another shoe swaps it, and says so.
  const [swapNote, setSwapNote] = useState<string | null>(null);
  const toggleItem = (itemId: number) => {
    const { ids, replaced } = toggleWithShoeRule(selectedItemIds, items, itemId);
    setDraft(ids);
    const incoming = items.find((item) => item.itemId === itemId);
    setSwapNote(
      replaced.length > 0 && incoming ? t('demo.replaced', { old: replaced.map((r) => r.name).join(t('builder.and')), new: incoming.name }) : null
    );
  };

  // Both this page and the real builder read the same global
  // useOutfitDraftStore, so a signed-out visit must not leave a selection a
  // later signed-in "/" visit would see (or inherit one from it).
  useEffect(() => {
    clearDraft();
    return () => clearDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [activeTab, setActiveTab] = useState<'attire' | 'closet'>('attire');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [gateReason, setGateReason] = useState<GateReason | null>(null);
  // Task 92: on a phone the Attire tab is two screens (the closet to pick from, and
  // your outfit), like the real builder; wide screens (lg+) show both side by side.
  const [phoneTab, setPhoneTab] = useState<'closet' | 'outfit'>('closet');
  // lg and up: the two-panel layout; below it (a phone) the controls are rearranged
  // (see useMediaQuery for why this is JS and not just CSS).
  const isWide = useMediaQuery('(min-width: 1024px)', true);

  const filteredItems = useMemo(
    () => items.filter((item) => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = activeCategory === 'ALL' || item.category === activeCategory;
      return matchesSearch && matchesCategory;
    }),
    [items, searchQuery, activeCategory]
  );

  const groupByCategories = (list: typeof items, cats: ClothingCategory[]) =>
    list
      .filter((item) => cats.includes(item.category))
      .sort((a, b) => cats.indexOf(a.category) - cats.indexOf(b.category));

  const browseSections = useMemo(
    () => SECTIONS
      .map((s) => ({ labelKey: s.labelKey, items: groupByCategories(filteredItems, s.categories) }))
      .filter((s) => s.items.length > 0),
    [filteredItems]
  );

  const selectedItems = useMemo(
    () => selectedItemIds
      .map((itemId) => items.find((item) => item.itemId === itemId))
      .filter((item): item is NonNullable<typeof item> => !!item),
    [selectedItemIds, items]
  );

  // Shoes are shown as the left/right pair row (ShoeSubRow), like the real builder; the other sections as cards.
  const shoeItems = useMemo(() => selectedItems.filter((item) => item.category === ClothingCategory.SHOES), [selectedItems]);
  const selectionSections = useMemo(
    () => SECTIONS
      .filter((s) => !s.categories.includes(ClothingCategory.SHOES))
      .map((s) => ({ labelKey: s.labelKey, items: groupByCategories(selectedItems, s.categories) }))
      .filter((s) => s.items.length > 0),
    [selectedItems]
  );

  const tabClass = (tab: 'attire' | 'closet') =>
    `flex items-center gap-2 px-3 lg:px-5 py-2 lg:py-2.5 rounded-lg text-[10px] font-medium uppercase tracking-widest transition-all ${
      activeTab === tab ? 'bg-ink text-background-main' : 'text-text-secondary hover:text-text-primary'
    }`;

  return (
    <div className="h-[calc(100dvh-5.5rem-env(safe-area-inset-top))] md:h-dvh bg-background-main flex flex-col overflow-hidden md:pt-16">
      <header className="px-3 py-2 lg:px-8 lg:py-5 border-b border-ink/5 bg-background-secondary/20 flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 lg:gap-4 z-20 shrink-0">
        <div className="flex items-center gap-3 lg:gap-6 min-w-0">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-ink/5 border border-ink/5">
            <button onClick={() => setActiveTab('attire')} className={tabClass('attire')}>
              <Shirt size={14} /> {t('demo.attire')}
            </button>
            <button onClick={() => setActiveTab('closet')} className={tabClass('closet')}>
              <LayoutGrid size={14} /> {t('demo.closet')}
            </button>
          </div>
          <p className="hidden lg:block text-[10px] font-medium text-accent tracking-[0.4em] uppercase whitespace-nowrap">
            {t(selectedItemIds.length === 1 ? 'demo.selectedOne' : 'demo.selectedMany', { count: selectedItemIds.length })}
          </p>
          {swapNote && (
            <p role="status" className="order-last basis-full lg:order-none lg:basis-auto text-[10px] font-medium text-text-secondary tracking-widest uppercase">
              {swapNote}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 lg:gap-4">
          <span
            title={t('demo.badgeTitle')}
            className="hidden md:inline-flex items-center gap-2 px-3.5 py-2 rounded-full border border-ink/10 bg-ink/[0.03] text-[9px] font-medium tracking-[0.25em] uppercase text-text-secondary"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-accent" /> {t('demo.badge')}
          </span>
          <button
            onClick={() => setGateReason('saveOutfit')}
            className="justify-center px-4 lg:px-8 py-3 bg-ink text-background-main font-medium text-[10px] rounded-xl flex items-center gap-3 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-ink/5 tracking-[0.2em]"
          >
            <Save size={16} /> <span className="lg:hidden">{t('demo.save')}</span><span className="hidden lg:inline">{t('demo.saveOutfit')}</span>
          </button>
        </div>
      </header>

      {activeTab === 'attire' ? (
        <div className="flex-grow min-h-0 flex flex-col lg:flex-row overflow-hidden">
          {/* Phone only (below lg): switch between the closet and the outfit. */}
          <div className="lg:hidden shrink-0 px-3 py-1.5 border-b border-ink/5 bg-background-secondary/20">
            <div role="tablist" aria-label={t('demo.tabs')} className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-ink/5">
              {([
                ['closet', t('demo.tabPieces')],
                ['outfit', t('builder.tabOutfit', { count: selectedItemIds.length })],
              ] as const).map(([tab, label]) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={phoneTab === tab}
                  onClick={() => setPhoneTab(tab)}
                  className={`py-2 rounded-lg text-[10px] font-medium uppercase tracking-widest transition-all ${
                    phoneTab === tab ? 'bg-ink text-background-main' : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <aside className={`${phoneTab === 'closet' ? 'flex' : 'hidden'} lg:flex flex-col w-full lg:w-96 lg:shrink-0 flex-1 min-h-0 lg:flex-none lg:border-r border-ink/5 bg-background-secondary/5`}>
            <div className="p-3 lg:p-6 border-b border-ink/5 flex items-center gap-2 lg:block lg:space-y-4">
              {isWide && (
                <div className="flex items-center justify-between">
                  <h3 className="text-[10px] font-medium text-text-primary tracking-[0.3em] uppercase opacity-50">
                    {t('builder.available')}
                  </h3>
                  <button
                    onClick={() => setGateReason('addClothes')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest text-accent hover:bg-accent/10 transition-colors"
                  >
                    <Plus size={12} /> {t('demo.addGarment')}
                  </button>
                </div>
              )}
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={14} />
                <input
                  type="text"
                  placeholder={t('builder.search')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-ink/5 border border-ink/10 rounded-xl py-3 pl-9 pr-4 text-text-primary text-[10px] font-medium tracking-widest focus:outline-none focus:border-accent/50 transition-all"
                />
              </div>
              <div className="w-[8.5rem] shrink-0 lg:w-auto">
                <ClothingCategoryFilter value={activeCategory} onChange={setActiveCategory} />
              </div>
              {!isWide && (
                <button
                  onClick={() => setGateReason('addClothes')}
                  aria-label={t('demo.addGarmentLabel')}
                  className="shrink-0 w-11 h-11 flex items-center justify-center rounded-xl border border-ink/10 text-accent"
                >
                  <Plus size={18} />
                </button>
              )}
            </div>
            <div className="flex-grow overflow-y-auto no-scrollbar p-3 lg:p-6 space-y-5 lg:space-y-8">
              {browseSections.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-20 text-center">
                  <Shirt size={32} className="text-text-secondary" />
                  <p className="text-[10px] font-medium uppercase tracking-widest">{t('builder.noPieces')}</p>
                </div>
              ) : (
                browseSections.map((section) => (
                  <div key={section.labelKey} className="space-y-2 lg:space-y-3">
                    <p className="text-[10px] font-medium text-text-secondary uppercase tracking-[0.3em] opacity-60">
                      {t(section.labelKey)}
                    </p>
                    <div className="grid grid-cols-3 gap-2 lg:grid-cols-2 lg:gap-4">
                      {section.items.map((item) => {
                        const active = selectedItemIds.includes(item.itemId);
                        return (
                          <motion.div
                            key={item.itemId}
                            whileHover={{ y: -4 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => toggleItem(item.itemId)}
                            className={`
                              relative aspect-[3/4] rounded-xl lg:rounded-2xl overflow-hidden cursor-pointer bg-ink/5 border transition-all duration-300 group
                              ${active ? 'border-accent ring-2 ring-accent/20' : 'border-ink/5 hover:border-ink/20'}
                            `}
                          >
                            <CroppedThumbnail imageUrl={item.imageUrl} transform={item.transform} alt={item.name} className="w-full h-full object-cover" />
                            <div className="absolute top-1.5 right-1.5 z-10 flex gap-1 opacity-0 group-hover:opacity-100 touch:hidden transition-opacity">
                              <button
                                onClick={(e) => { e.stopPropagation(); setGateReason('editClothes'); }}
                                className="p-1.5 touch:p-2.5 bg-black/60 hover:bg-black/80 rounded-full text-white"
                                title={t('demo.edit')}
                              >
                                <Pencil size={10} />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); setGateReason('deleteClothes'); }}
                                className="p-1.5 touch:p-2.5 bg-black/60 hover:bg-red-500/80 rounded-full text-white"
                                title={t('demo.delete')}
                              >
                                <Trash2 size={10} />
                              </button>
                            </div>
                            <div className={`
                              absolute inset-0 bg-accent/20 flex items-center justify-center transition-opacity
                              ${active ? 'opacity-100' : 'opacity-0'}
                            `}>
                              <div className="bg-ink text-accent p-2 rounded-full shadow-md">
                                <X size={16} className="rotate-45" />
                              </div>
                            </div>
                            <div className="absolute bottom-0 left-0 right-0 p-1.5 lg:p-3 bg-gradient-to-t from-black/80 to-transparent">
                              <p className="text-[9px] lg:text-[10px] font-bold text-white line-clamp-1 uppercase tracking-wider">{item.name}</p>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
            {/* Phone: what you have picked so far, and the way to the Outfit tab. */}
            {!isWide && selectedItemIds.length > 0 && (
              <div className="shrink-0 border-t border-ink/10 bg-background-main px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
                <div className="flex items-center gap-2.5">
                  <div className="flex-1 min-w-0 flex gap-1.5 overflow-x-auto no-scrollbar py-1" aria-label={t('builder.selectedPieces')}>
                    {selectedItems.map((item) => (
                      <div key={item.itemId} className="shrink-0 w-11 h-[3.75rem] rounded-lg overflow-hidden bg-ink/5 border border-accent/30">
                        <CroppedThumbnail imageUrl={item.imageUrl} transform={item.transform} alt={item.name} className="w-full h-full" />
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setPhoneTab('outfit')}
                    aria-label={t('builder.viewOutfit', { count: selectedItemIds.length })}
                    className="shrink-0 h-12 px-3.5 rounded-xl bg-ink text-background-main text-[10px] font-medium uppercase tracking-[0.15em] leading-tight flex flex-col items-center justify-center"
                  >
                    <span>{t('builder.outfit')}</span>
                    <span className="opacity-70">{selectedItemIds.length}</span>
                  </button>
                </div>
              </div>
            )}
          </aside>

          <main className={`${phoneTab === 'outfit' ? 'block' : 'hidden'} lg:block flex-1 min-h-0 relative bg-background-main overflow-y-auto no-scrollbar p-4 lg:p-6`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[10px] font-medium text-text-primary tracking-[0.3em] uppercase opacity-50">
                {t('builder.yourSelection')}
              </h3>
              <button
                onClick={() => setGateReason('persona')}
                disabled={selectedItems.length === 0}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-medium uppercase tracking-widest transition-all border border-ink/5 bg-ink/[0.02] text-text-secondary hover:text-text-primary hover:border-ink/20 disabled:opacity-20 disabled:pointer-events-none"
              >
                <User size={12} /> {t('showcase.viewOnPersona')}
              </button>
            </div>

            {selectedItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-32 gap-4 opacity-20 text-center">
                <Shirt size={40} className="text-text-secondary" />
                <p className="text-[10px] font-medium uppercase tracking-widest">
                  <span className="lg:hidden">{t('demo.pickPieces')}</span>
                  <span className="hidden lg:inline">{t('builder.pickWide')}</span>
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {selectionSections.map((section) => (
                  <div key={section.labelKey} className="space-y-1.5">
                    <p className="text-[10px] font-medium text-text-secondary uppercase tracking-[0.3em] opacity-60">
                      {t(section.labelKey)}
                    </p>
                    <div className="flex flex-wrap gap-4 justify-center">
                      {section.items.map((item) => (
                        <SelectionCard key={item.itemId} item={item} onRemove={removeItem} showPersonaBadge={false} />
                      ))}
                    </div>
                  </div>
                ))}
                {shoeItems.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-medium text-text-secondary uppercase tracking-[0.3em] opacity-60">
                      {t('builder.shoes')}
                    </p>
                    <ShoeSubRow items={shoeItems} onRemove={removeItem} showPersonaBadge={false} />
                  </div>
                )}
              </div>
            )}
          </main>
        </div>
      ) : (
        <div className="flex-grow overflow-y-auto no-scrollbar p-8">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-10">
              <div className="space-y-2">
                <h1 className="text-4xl font-light tracking-tighter text-text-primary uppercase">
                  {t('demo.wardrobeA')} <span className="text-accent">{t('demo.wardrobeB')}</span>
                </h1>
                <p className="text-text-secondary text-[10px] font-medium uppercase tracking-widest">
                  {t('demo.piecesCount', { count: filteredItems.length })}
                </p>
              </div>
              <button
                onClick={() => setGateReason('addClothes')}
                className="px-8 py-4 bg-ink text-background-main font-medium rounded-xl flex items-center gap-3 transition-all hover:scale-105 active:scale-95 text-[10px] tracking-[0.2em] uppercase"
              >
                <Plus size={16} /> {t('closet.add')}
              </button>
            </div>

            <div className="flex flex-col gap-4 mb-10">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" size={16} />
                <input
                  type="text"
                  placeholder={t('closet.search')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-ink/5 border border-ink/10 rounded-2xl py-4 pl-11 pr-6 text-text-primary text-[10px] font-medium tracking-widest focus:outline-none focus:border-accent/50 transition-all"
                />
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {(['ALL', ...Object.values(ClothingCategory)] as Array<'ALL' | ClothingCategory>).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-6 py-3 rounded-2xl text-[10px] font-medium uppercase tracking-widest transition-all border ${
                      activeCategory === cat
                        ? 'bg-accent text-on-accent border-accent shadow-lg'
                        : 'bg-ink/5 text-text-secondary border-ink/5 hover:border-ink/20'
                    }`}
                  >
                    {t(`cat.${cat}`)}
                  </button>
                ))}
              </div>
            </div>

            {filteredItems.length === 0 ? (
              <div className="py-32 flex flex-col items-center justify-center text-center border-2 border-dashed border-ink/5 rounded-2xl">
                <Shirt size={40} className="text-text-secondary opacity-20 mb-6" />
                <p className="text-text-secondary text-[10px] font-medium tracking-widest uppercase">{t('demo.noGarments')}</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                {filteredItems.map((item) => {
                  const active = selectedItemIds.includes(item.itemId);
                  return (
                    <motion.div key={item.itemId} whileHover={{ y: -4 }} className="group cursor-pointer" onClick={() => toggleItem(item.itemId)}>
                      <div className={`relative aspect-[3/4] rounded-xl overflow-hidden mb-3 border transition-all duration-300 ${
                        active ? 'border-accent ring-2 ring-accent/20 shadow-lg' : 'border-ink/5 bg-ink/5 hover:border-ink/20'
                      }`}>
                        <CroppedThumbnail imageUrl={item.imageUrl} transform={item.transform} alt={item.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                        <div className="absolute inset-0 bg-background-main/60 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 touch:hidden transition-all duration-300 flex flex-col items-center justify-center gap-3">
                          <div className="flex gap-2">
                            <button
                              onClick={(e) => { e.stopPropagation(); setGateReason('editClothes'); }}
                              className="p-2 bg-ink/10 hover:bg-ink/20 text-text-primary rounded-lg transition-colors border border-ink/10"
                              title={t('demo.edit')}
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setGateReason('deleteClothes'); }}
                              className="p-2 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white rounded-lg transition-all border border-rose-500/10"
                              title={t('demo.delete')}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-all text-[10px] font-medium uppercase tracking-widest ${
                            active ? 'bg-accent text-on-accent shadow-lg' : 'bg-ink/10 text-ink/50'
                          }`}>
                            <Shirt size={10} />
                            <span>{active ? t('demo.selected') : t('demo.select')}</span>
                          </div>
                        </div>
                        {/* Touch screens have no hover: small always-visible actions instead of the overlay. */}
                        <div className="hidden touch:flex absolute top-2 right-2 z-10 gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); setGateReason('editClothes'); }}
                            className="p-2.5 bg-black/60 rounded-full text-white"
                            aria-label={t('demo.editNamed', { name: item.name })}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setGateReason('deleteClothes'); }}
                            className="p-2.5 bg-black/60 rounded-full text-white"
                            aria-label={t('demo.deleteNamed', { name: item.name })}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      <div className="px-1">
                        <h3 className={`text-[10px] font-bold tracking-tight line-clamp-1 transition-colors ${active ? 'text-accent' : 'text-text-primary group-hover:text-accent'}`}>
                          {item.name}
                        </h3>
                        <p className="text-[10px] text-text-secondary font-medium tracking-widest uppercase opacity-40 mt-0.5">
                          {t(`cat.${item.category}`)}
                          {item.category === ClothingCategory.SHOES && item.side && ` · ${t(`side.${item.side}`)}`}
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      <DemoSignupModal
        isOpen={gateReason !== null}
        onClose={() => setGateReason(null)}
        reason={gateReason ? t(`demoSignup.reason.${gateReason}`) : ''}
        {...(gateReason === 'persona' && {
          mediaSrc: PERSONA_GIF,
          mediaAlt: t('demoSignup.personaAlt'),
        })}
      />
    </div>
  );
};

export default DemoPage;
