import { create } from 'zustand';
import type { Collection } from '../types';
import { collectionService } from '../api/collectionService';

// Mirrors useOutfitStore's pattern (Task 48, Phase 9). The four
// membership actions (addItem/removeItem/addOutfit/removeOutfit) replace
// the affected collection with the server's response rather than
// hand-patching local state - CollectionResponse already returns the full
// updated items/outfits lists, so this stays correct without duplicating
// that logic client-side.
interface CollectionState {
  collections: Collection[];
  isLoading: boolean;
  error: string | null;
  fetchCollections: () => Promise<void>;
  createCollection: (name: string) => Promise<Collection>;
  renameCollection: (collectionId: number, name: string) => Promise<void>;
  deleteCollection: (collectionId: number) => Promise<void>;
  addItem: (collectionId: number, itemId: number) => Promise<void>;
  removeItem: (collectionId: number, itemId: number) => Promise<void>;
  addOutfit: (collectionId: number, outfitId: number) => Promise<void>;
  removeOutfit: (collectionId: number, outfitId: number) => Promise<void>;
}

export const useCollectionStore = create<CollectionState>((set) => ({
  collections: [],
  isLoading: false,
  error: null,

  fetchCollections: async () => {
    set({ isLoading: true, error: null });
    try {
      const collections = await collectionService.getCollections();
      set({ collections, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  createCollection: async (name) => {
    set({ isLoading: true, error: null });
    try {
      const newCollection = await collectionService.createCollection(name);
      set((state) => ({ collections: [...state.collections, newCollection], isLoading: false }));
      return newCollection;
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      throw err;
    }
  },

  renameCollection: async (collectionId, name) => {
    set({ isLoading: true, error: null });
    try {
      const updated = await collectionService.renameCollection(collectionId, name);
      set((state) => ({
        collections: state.collections.map((c) => (c.collectionId === collectionId ? updated : c)),
        isLoading: false,
      }));
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  deleteCollection: async (collectionId) => {
    set({ isLoading: true, error: null });
    try {
      await collectionService.deleteCollection(collectionId);
      set((state) => ({
        collections: state.collections.filter((c) => c.collectionId !== collectionId),
        isLoading: false,
      }));
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  addItem: async (collectionId, itemId) => {
    try {
      const updated = await collectionService.addItemToCollection(collectionId, itemId);
      set((state) => ({
        collections: state.collections.map((c) => (c.collectionId === collectionId ? updated : c)),
      }));
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  removeItem: async (collectionId, itemId) => {
    try {
      const updated = await collectionService.removeItemFromCollection(collectionId, itemId);
      set((state) => ({
        collections: state.collections.map((c) => (c.collectionId === collectionId ? updated : c)),
      }));
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  addOutfit: async (collectionId, outfitId) => {
    try {
      const updated = await collectionService.addOutfitToCollection(collectionId, outfitId);
      set((state) => ({
        collections: state.collections.map((c) => (c.collectionId === collectionId ? updated : c)),
      }));
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  removeOutfit: async (collectionId, outfitId) => {
    try {
      const updated = await collectionService.removeOutfitFromCollection(collectionId, outfitId);
      set((state) => ({
        collections: state.collections.map((c) => (c.collectionId === collectionId ? updated : c)),
      }));
    } catch (err: any) {
      set({ error: err.message });
    }
  },
}));
