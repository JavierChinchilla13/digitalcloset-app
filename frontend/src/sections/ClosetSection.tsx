import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Plus, LayoutPanelTop } from 'lucide-react';
import { ClothingCategory, type ClothingItem } from '../types';
import SectionWrapper from '../components/SectionWrapper';
import { useClothingStore } from '../store/useClothingStore';
import { usePersonaStore } from '../store/usePersonaStore';
import { useNavigate } from 'react-router-dom';
import { PersonaType } from '../types';
import UploadFlow from '../components/FittingTool/UploadFlow';
import ClothingCard from '../components/ClothingCard';
import ClothingDetailsModal from '../components/ClothingDetailsModal';
import EditClothingModal from '../components/EditClothingModal';

const ClosetSection = () => {
  const { items, isLoading, fetchItems, removeItem } = useClothingStore();
  const { persona } = usePersonaStore();
  const navigate = useNavigate();
  
  // Modal States
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  // Selected Item State
  const [selectedItem, setSelectedItem] = useState<ClothingItem | null>(null);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleViewDetails = (item: ClothingItem) => {
    setSelectedItem(item);
    setIsDetailsModalOpen(true);
  };

  const handleEdit = (item: ClothingItem) => {
    setSelectedItem(item);
    setIsEditModalOpen(true);
  };

  const handleDelete = (item: ClothingItem) => {
    removeItem(item.itemId);
  };

  // Filter items by persona gender
  const filteredItems = items.filter(item => {
    // If the item has a personaType, it must match. 
    // If it doesn't (legacy), we show it.
    return !item.personaType || item.personaType === persona.type;
  });

  // Group items by category
  const groupedItems = filteredItems.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, ClothingItem[]>);

  const categories = Object.keys(groupedItems).length > 0 
    ? Object.entries(groupedItems).filter(([category]) => category !== ClothingCategory.ACCESSORY) 
    : [];

  return (
    <SectionWrapper className="bg-background-secondary/10 border-y border-white/5 py-16">
      <div className="flex justify-between items-end mb-12 px-2">
        <div>
          <h2 className="text-4xl font-light tracking-tighter mb-2 uppercase">Your Closet</h2>
          <p className="text-text-secondary text-[10px] uppercase tracking-widest opacity-40">Digital Inventory // Categorized Selection</p>
        </div>
        <div className="flex flex-col gap-3">
          <button 
            onClick={() => navigate('/closet')}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-all border border-white/5 font-black text-[10px] uppercase tracking-widest"
          >
            <LayoutPanelTop size={14} className="text-accent" />
            <span>View Full Closet</span>
          </button>
          
          <button 
            onClick={() => setIsUploadModalOpen(true)}
            className="flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-white px-5 py-2.5 rounded-lg font-black transition-all shadow-lg shadow-accent/20 text-[10px] uppercase tracking-widest"
          >
            <Plus size={14} />
            <span>Add Garment</span>
          </button>
        </div>
      </div>

      {isLoading && items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-30">
          <Loader2 className="animate-spin text-accent" size={32} />
          <p className="text-[10px] font-black tracking-[0.2em] uppercase">Syncing Wardrobe...</p>
        </div>
      ) : categories.length === 0 ? (
        <div className="text-center py-24 border-2 border-dashed border-white/5 rounded-3xl opacity-20">
          <p className="text-[10px] text-text-secondary uppercase tracking-[0.3em] font-black">Your closet is empty</p>
        </div>
      ) : (
        <div className="space-y-16">
          {categories.map(([category, categoryItems], categoryIdx) => (
            <motion.div 
              key={category}
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: categoryIdx * 0.1 }}
            >
              <div className="flex items-center gap-4 mb-6">
                <span className="text-[10px] font-black tracking-[0.3em] text-accent uppercase">{category}</span>
                <div className="h-[1px] flex-grow bg-white/5" />
                <button className="text-[8px] font-bold text-text-secondary hover:text-white transition-colors uppercase tracking-widest">
                  {categoryItems.length} ITEMS
                </button>
              </div>

              <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar scroll-smooth">
                {categoryItems.map((item) => (
                  <ClothingCard 
                    key={item.itemId}
                    item={item}
                    onViewDetails={handleViewDetails}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    showManagement={true}
                  />
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Modals */}
      <UploadFlow 
        isOpen={isUploadModalOpen} 
        onClose={() => setIsUploadModalOpen(false)} 
      />

      <ClothingDetailsModal
        item={selectedItem}
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
      />

      <EditClothingModal 
        item={selectedItem}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
      />
    </SectionWrapper>
  );
};

export default ClosetSection;
