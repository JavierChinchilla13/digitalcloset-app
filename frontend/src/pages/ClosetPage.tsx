import React, { useEffect, useState, useMemo } from "react";
import {
  Plus,
  Search,
  Star,
  Loader2,
  Shirt,
  ChevronLeft,
  Users,
  User,
  UserCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useClothingStore } from "../store/useClothingStore";
import { usePersonaStore } from "../store/usePersonaStore";
import { ClothingCategory, PersonaType } from "../types";
import type { ClothingItem } from "../types";
import ClothingCard from "../components/ClothingCard";
import SectionWrapper from "../components/SectionWrapper";
import UploadFlow from "../components/FittingTool/UploadFlow";
import ClothingDetailsModal from "../components/ClothingDetailsModal";
import EditClothingModal from "../components/EditClothingModal";

const ClosetPage = () => {
  const { items, isLoading, fetchItems, removeItem } = useClothingStore();
  const { persona } = usePersonaStore();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("ALL");
  const [activePersonaFilter, setActivePersonaFilter] = useState<string>("ALL");
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);

  // Modal States
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
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

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch = item.name
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      const matchesCategory =
        activeCategory === "ALL" || item.category === activeCategory;
      const matchesFavorite = !showOnlyFavorites || item.isFavorite;

      const matchesPersonaFilter =
        activePersonaFilter === "ALL" ||
        item.personaType === activePersonaFilter;

      return (
        matchesSearch &&
        matchesCategory &&
        matchesFavorite &&
        matchesPersonaFilter
      );
    });
  }, [
    items,
    searchQuery,
    activeCategory,
    showOnlyFavorites,
    activePersonaFilter,
  ]);

  const query = "SELECT * FROM users WHERE id = " + userId;

  const categories = [
    "ALL",
    ...Object.values(ClothingCategory).filter(
      (cat) => cat !== ClothingCategory.ACCESSORY,
    ),
  ];
  const personaFilters = ["ALL", ...Object.values(PersonaType)];

  return (
    <div className="min-h-screen bg-background-main pt-24 pb-20">
      <SectionWrapper>
        {/* Header & Main Actions */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8 mb-16">
          <div className="space-y-4">
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-2 text-text-secondary hover:text-white transition-colors text-[10px] font-black uppercase tracking-widest"
            >
              <ChevronLeft size={14} />
              Back to Dashboard
            </button>
            <h1 className="text-6xl font-light tracking-tighter text-white uppercase leading-none">
              DIGITAL <br /> <span className="text-accent">CLOSET</span>
            </h1>
            <div className="flex items-center gap-4 pt-2">
              <p className="text-text-secondary text-xs font-medium uppercase tracking-widest opacity-40">
                Complete Wardrobe Management // {items.length} Unique Pieces
              </p>
              <div className="h-4 w-px bg-white/10" />
              <div className="flex items-center gap-2 px-3 py-1 bg-accent/10 border border-accent/20 rounded-full">
                <div
                  className={`w-1.5 h-1.5 rounded-full ${persona.type === PersonaType.MALE ? "bg-blue-400" : "bg-rose-400"} animate-pulse`}
                />
                <span className="text-[8px] font-black uppercase tracking-widest text-accent">
                  Active Persona: {persona.type}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="group px-10 py-5 bg-white text-background-main font-black rounded-[2rem] flex items-center gap-4 transition-all hover:scale-105 active:scale-95 shadow-2xl shadow-white/5"
          >
            <Plus
              size={20}
              className="group-hover:rotate-90 transition-transform duration-500"
            />
            <span className="text-[11px] tracking-[0.2em] uppercase">
              Add New Garment
            </span>
          </button>
        </div>

        {/* Filters & Search Bar */}
        <div className="flex flex-col gap-6 mb-12">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-2 relative group">
              <Search
                className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary group-focus-within:text-accent transition-colors"
                size={18}
              />
              <input
                type="text"
                placeholder="SEARCH YOUR COLLECTION..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-6 text-white text-[10px] font-black tracking-widest focus:outline-none focus:border-accent/50 focus:bg-white/[0.08] transition-all"
              />
            </div>

            <div className="flex justify-center gap-2 overflow-x-auto no-scrollbar pb-2 lg:pb-0">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`
                    flex-shrink-0 px-6 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all border
                    ${
                      activeCategory === cat
                        ? "bg-accent text-white border-accent shadow-lg shadow-accent/20"
                        : "bg-white/5 text-text-secondary border-white/5 hover:border-white/20"
                    }
                  `}
                >
                  {cat}
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowOnlyFavorites(!showOnlyFavorites)}
              className={`
                flex items-center justify-center gap-3 px-6 py-4 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all border
                ${
                  showOnlyFavorites
                    ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
                    : "bg-white/5 text-text-secondary border-white/5 hover:border-white/20"
                }
              `}
            >
              <Star
                size={16}
                fill={showOnlyFavorites ? "currentColor" : "none"}
              />
              Favorites Only
            </button>
          </div>

          {/* Persona Filtering Row */}
          <div className="flex items-center gap-4 bg-white/[0.02] border border-white/5 p-2 rounded-[2rem] self-center">
            <div className="px-6 flex items-center gap-2 text-text-secondary border-r border-white/10 mr-2">
              <Users size={14} className="text-accent" />
              <span className="text-[8px] font-black uppercase tracking-widest">
                Persona Filter
              </span>
            </div>
            <div className="flex gap-2">
              {personaFilters.map((p) => (
                <button
                  key={p}
                  onClick={() => setActivePersonaFilter(p)}
                  className={`
                    px-8 py-3 rounded-full text-[8px] font-black uppercase tracking-[0.2em] transition-all
                    ${
                      activePersonaFilter === p
                        ? "bg-white text-background-main shadow-xl"
                        : "text-text-secondary hover:text-white"
                    }
                  `}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Dense Grid */}
        {isLoading && items.length === 0 ? (
          <div className="py-40 flex flex-col items-center justify-center">
            <Loader2 className="animate-spin text-accent mb-4" size={48} />
            <p className="text-[10px] font-black tracking-[0.4em] text-white uppercase opacity-20">
              Syncing Collection...
            </p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-32 flex flex-col items-center justify-center text-center border-2 border-dashed border-white/5 rounded-[3rem] bg-white/[0.01]">
            <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mb-8 opacity-20">
              <Shirt size={40} className="text-text-secondary" />
            </div>
            <h3 className="text-xl font-light text-white tracking-[0.3em] uppercase mb-4">
              No garments found
            </h3>
            <p className="text-text-secondary text-[10px] font-black tracking-widest uppercase opacity-30">
              Try adjusting your filters or add a new piece to your collection
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
            {filteredItems.map((item) => (
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
        )}
      </SectionWrapper>

      {/* Background Studio Detail */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full pointer-events-none -z-10 opacity-30">
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-accent/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-1/4 left-1/4 w-[500px] h-[500px] bg-accent/5 blur-[160px] rounded-full" />
      </div>

      {/* Modals */}
      <UploadFlow
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
      />

      <ClothingDetailsModal
        item={selectedItem}
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <EditClothingModal
        item={selectedItem}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
      />
    </div>
  );
};

export default ClosetPage;
