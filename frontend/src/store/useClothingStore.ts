import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ClothingCategory, PersonaStatus } from '../types';
import type { ClothingItem } from '../types';
import { clothingService } from '../api/clothingService';

interface ClothingState {
  items: ClothingItem[];
  favorites: number[]; // Array of itemId
  isLoading: boolean;
  error: string | null;
  _hasHydrated: boolean;
  setHasHydrated: (state: boolean) => void;
  fetchItems: (category?: ClothingCategory) => Promise<void>;
  addItem: (data: Omit<ClothingItem, 'itemId'>) => Promise<ClothingItem>;
  updateItem: (itemId: number, data: Partial<ClothingItem>) => Promise<void>;
  removeItem: (itemId: number) => Promise<void>;
  toggleFavorite: (itemId: number) => void;
  markItemAsFitted: (itemId: number) => Promise<void>;
}

// The closet: the user's garments, loaded from the API and cached in localStorage
// ("clothing-closet-storage") so the page has something to show before the fetch
// returns. Every mutating action talks to the API first and only then updates the
// list, and rethrows on failure so callers can toast. Favourites are a purely local
// feature (the id list is kept in this browser under "closet-favorites", not on the
// server).
export const useClothingStore = create<ClothingState>()(
  persist(
    (set, get) => ({
      items: [],
      favorites: JSON.parse(localStorage.getItem('closet-favorites') || '[]'),
      isLoading: false,
      error: null,
      _hasHydrated: false,
      setHasHydrated: (state) => set({ _hasHydrated: state }),

      // Replaces the list with the server's (optionally one category) and marks each item with its local favourite flag.
      fetchItems: async (category) => {
        set({ isLoading: true, error: null });
        try {
          const items = await clothingService.getClothingItems(category);
          // Augment items with favorite state
          const favorites = JSON.parse(localStorage.getItem('closet-favorites') || '[]');
          const augmentedItems = items.map(item => ({
            ...item,
            isFavorite: favorites.includes(item.itemId)
          }));
          set({ items: augmentedItems, isLoading: false });
        } catch (err: any) {
          set({ error: err.message, isLoading: false });
        }
      },

      // Creates the garment on the server and appends the saved version (with its new id).
      addItem: async (data) => {
        set({ isLoading: true, error: null });
        try {
          const newItem = await clothingService.createClothingItem(data);
          const currentItems = get().items;
          set({ items: [...currentItems, newItem], isLoading: false });
          return newItem;
        } catch (err: any) {
          set({ error: err.message, isLoading: false });
          throw err;
        }
      },

      // Partial update on the server, then swaps in the saved item, keeping its favourite flag.
      updateItem: async (itemId, data) => {
        set({ isLoading: true, error: null });
        try {
          const updatedItem = await clothingService.updateClothingItem(itemId, data);
          const { items, favorites } = get();
          set({
            items: items.map((item) => (item.itemId === itemId ? { ...updatedItem, isFavorite: favorites.includes(itemId) } : item)),
            isLoading: false,
          });
        } catch (err: any) {
          set({ error: err.message, isLoading: false });
          throw err;
        }
      },

      // Deletes on the server (a soft delete there) and drops it from the list.
      removeItem: async (itemId) => {
        set({ isLoading: true, error: null });
        try {
          await clothingService.deleteClothingItem(itemId);
          const currentItems = get().items;
          set({
            items: currentItems.filter((item) => item.itemId !== itemId),
            isLoading: false,
          });
        } catch (err: any) {
          set({ error: err.message, isLoading: false });
          throw err;
        }
      },

      // Flips the local favourite flag; saved to localStorage immediately, no API call.
      toggleFavorite: (itemId) => {
        const { items, favorites } = get();
        const isFavorite = favorites.includes(itemId);
        const newFavorites = isFavorite 
          ? favorites.filter(id => id !== itemId)
          : [...favorites, itemId];
        
        localStorage.setItem('closet-favorites', JSON.stringify(newFavorites));
        
        set({
          favorites: newFavorites,
          items: items.map(item =>
            item.itemId === itemId ? { ...item, isFavorite: !isFavorite } : item
          )
        });
      },

      // Task 44: named "promote to fitted" wrapper around updateItem, for
      // the flat builder's excluded-item quick actions - a NOT_FITTED item
      // just gets its default preset transform, not a custom fit.
      markItemAsFitted: async (itemId) => {
        await get().updateItem(itemId, { personaStatus: PersonaStatus.FITTED });
      },
    }),
    {
      name: 'clothing-closet-storage',
      partialize: (state) => ({ items: state.items, favorites: state.favorites }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      }
    }
  )
);
