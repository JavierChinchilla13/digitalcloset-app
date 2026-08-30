import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  Save,
  Loader2,
  Sparkles,
  RotateCcw,
  Plus
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useClothingStore } from '../store/useClothingStore';
import { usePersonaStore } from '../store/usePersonaStore';
import { useOutfitStore, outfitItemsFromEquipped, equippedFromOutfitItems } from '../store/useOutfitStore';
import type { OutfitRequest } from '../types';
import { ClothingCategory } from '../types';
import PersonaRenderer from '../components/PersonaRenderer';

const OutfitBuilderPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { fetchItems, isLoading: loadingCloset, items: closetItems } = useClothingStore();
  const { persona, updatePersona, setEquippedItem, clearEquipped } = usePersonaStore();
  const { outfits, fetchOutfits, saveOutfit, updateOutfit } = useOutfitStore();

  const [outfitName, setOutfitName] = useState('New Style');
  const [activeCategory, setActiveCategory] = useState<ClothingCategory>(ClothingCategory.TOP);
  const [isSaving, setIsSaving] = useState(false);
  const [outfitsReady, setOutfitsReady] = useState(false);

  useEffect(() => {
    fetchItems();
    fetchOutfits().finally(() => setOutfitsReady(true));
  }, [fetchItems, fetchOutfits]);

  // Once outfits have loaded, if editing, load the existing outfit into the
  // persona so the builder reflects what's actually equipped.
  useEffect(() => {
    if (!outfitsReady || !id) return;
    const existing = outfits.find(o => String(o.outfitId) === id);
    if (existing) {
      setOutfitName(existing.name);
      updatePersona(equippedFromOutfitItems(existing.items));
    }
  }, [id, outfits, outfitsReady, updatePersona]);

  const handleSave = async () => {
    setIsSaving(true);

    const outfitData: OutfitRequest = {
      name: outfitName,
      avatarType: persona.type,
      items: outfitItemsFromEquipped(persona),
    };

    try {
      if (id) {
        await updateOutfit(Number(id), outfitData);
      } else {
        await saveOutfit(outfitData);
      }
      navigate('/outfits');
    } finally {
      setIsSaving(false);
    }
  };

  const clearLook = () => {
    clearEquipped();
  };

  const isEquipped = (itemId: number) => {
    if (!persona) return false;
    return (
      (persona.topIds?.includes(itemId) ?? false) ||
      (persona.bottomIds?.includes(itemId) ?? false) ||
      persona.leftShoeId === itemId ||
      persona.rightShoeId === itemId ||
      (persona.accessoryIds?.includes(itemId) ?? false) ||
      (persona.jacketIds?.includes(itemId) ?? false) ||
      (persona.dressIds?.includes(itemId) ?? false)
    );
  };

  const toggleItem = (item: any) => {
    setEquippedItem(item);
  };

  if (!outfitsReady) {
    return (
      <div className="min-h-screen bg-background-main flex items-center justify-center">
        <Loader2 className="animate-spin text-accent" size={40} />
      </div>
    );
  }

  return (
    <div className="h-screen bg-background-main flex flex-col overflow-hidden pt-16">
      {/* Dynamic Header */}
      <header className="px-8 py-6 border-b border-white/5 bg-background-secondary/20 flex items-center justify-between z-20">
        <div className="flex items-center gap-6">
          <button 
            onClick={() => navigate('/outfits')}
            className="p-3 hover:bg-white/5 rounded-xl text-text-secondary transition-colors border border-white/5"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="space-y-1">
            <input 
              value={outfitName} 
              onChange={e => setOutfitName(e.target.value)}
              className="bg-transparent text-xl font-light text-white tracking-widest uppercase focus:outline-none border-b border-transparent focus:border-accent/50 transition-all"
              placeholder="ENTER STYLE NAME"
            />
            <p className="text-[8px] font-black text-accent tracking-[0.4em] uppercase">Style Orchestration Mode</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={clearLook}
            className="p-3 hover:bg-white/5 rounded-xl text-text-secondary hover:text-white transition-colors border border-white/5"
            title="Reset Look"
          >
            <RotateCcw size={18} />
          </button>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="px-8 py-3 bg-white text-background-main font-black text-[10px] rounded-xl flex items-center gap-3 transition-all hover:scale-105 active:scale-95 shadow-2xl shadow-white/5 tracking-[0.2em]"
          >
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {id ? 'UPDATE STYLE' : 'SAVE TO COLLECTION'}
          </button>
        </div>
      </header>

      <div className="flex-grow flex overflow-hidden">
        {/* Left Panel: Category Selector */}
        <aside className="w-20 border-r border-white/5 flex flex-col items-center py-8 gap-8 bg-black/20">
          {Object.values(ClothingCategory)
            .map((cat) => (
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
                <motion.div 
                  layoutId="activeTab"
                  className="absolute -right-[1px] w-[2px] h-8 bg-accent"
                />
              )}
            </button>
          ))}
        </aside>

        {/* Center Panel: Wardrobe Grid */}
        <aside className="w-80 border-r border-white/5 flex flex-col bg-background-secondary/5">
          <div className="p-6 border-b border-white/5">
            <h3 className="text-[10px] font-black text-white tracking-[0.3em] uppercase opacity-50 flex items-center gap-2">
              <Sparkles size={12} className="text-accent" />
              Available Pieces
            </h3>
          </div>
          <div className="flex-grow overflow-y-auto no-scrollbar p-6 space-y-4">
            {loadingCloset ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-20">
                <Loader2 className="animate-spin text-accent" size={24} />
                <p className="text-[8px] font-black uppercase tracking-widest">Syncing Wardrobe...</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {closetItems
                  .filter(i => i.category === activeCategory && (!i.personaType || i.personaType === persona.type))
                  .map((item) => {
                    const active = isEquipped(item.itemId);
                    return (
                      <motion.div
                        key={item.itemId}
                        whileHover={{ y: -4 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => toggleItem(item)}
                        className={`
                          relative aspect-[3/4] rounded-2xl overflow-hidden cursor-pointer border transition-all duration-300
                          ${active ? 'border-accent ring-2 ring-accent/20' : 'border-white/5 hover:border-white/20'}
                        `}
                      >
                        <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                        <div className={`
                          absolute inset-0 bg-accent/20 flex items-center justify-center transition-opacity
                          ${active ? 'opacity-100' : 'opacity-0'}
                        `}>
                          <div className="bg-white text-accent p-2 rounded-full shadow-xl">
                            <Plus size={16} className="rotate-45" />
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

        {/* Right Panel: Persona Preview */}
        <main className="flex-grow relative bg-background-main flex items-center justify-center">
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
            style={{ 
              backgroundImage: 'radial-gradient(#5B8CFF 1px, transparent 1px)', 
              backgroundSize: '40px 40px' 
            }} 
          />
          
          <div className="w-full h-full max-w-2xl max-h-[85vh]">
            <PersonaRenderer persona={persona} />
          </div>

          {/* Quick HUD Detail */}
          <div className="absolute bottom-8 right-8 flex flex-col items-end gap-2 opacity-20">
            <p className="text-[6px] font-black tracking-[0.5em] text-white uppercase">Real-time Layering Active</p>
            <div className="h-[1px] w-24 bg-gradient-to-l from-white to-transparent" />
          </div>
        </main>
      </div>
    </div>
  );
};

export default OutfitBuilderPage;
