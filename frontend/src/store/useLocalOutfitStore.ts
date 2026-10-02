import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { PersonaType } from '../types';

// LEGACY, UNUSED: the browser-only outfit store from before outfits moved to the
// database (useOutfitStore). It is still persisted under "saved-outfits-storage", so
// old data may sit in a user's browser, but nothing reads it any more.
export interface LocalOutfit {
  id: string;
  name: string;
  createdAt: string;
  preview: string; // Base64 or URL
  personaType: PersonaType;
  items: {
    topIds: number[];
    bottomIds: number[];
    leftShoeId: number | null;
    rightShoeId: number | null;
    accessoryIds: number[];
    jacketIds: number[];
    dressIds: number[];
  };
}

interface LocalOutfitStore {
  outfits: LocalOutfit[];
  _hasHydrated: boolean;
  setHasHydrated: (state: boolean) => void;
  saveOutfit: (outfit: Omit<LocalOutfit, 'id' | 'createdAt'>) => void;
  updateOutfit: (id: string, updates: Partial<LocalOutfit>) => void;
  deleteOutfit: (id: string) => void;
  duplicateOutfit: (id: string) => void;
}

// Zustand store with save / update / delete / duplicate of local outfits.
export const useLocalOutfitStore = create<LocalOutfitStore>()(
  persist(
    (set) => ({
      outfits: [],
      _hasHydrated: false,
      setHasHydrated: (state) => set({ _hasHydrated: state }),
      saveOutfit: (outfit) => set((state) => ({
        outfits: [
          {
            ...outfit,
            id: crypto.randomUUID(),
            createdAt: new Date().toISOString(),
          },
          ...state.outfits
        ]
      })),
      updateOutfit: (id, updates) => set((state) => ({
        outfits: state.outfits.map((o) => (o.id === id ? { ...o, ...updates } : o))
      })),
      deleteOutfit: (id) => set((state) => ({
        outfits: state.outfits.filter((o) => o.id !== id)
      })),
      duplicateOutfit: (id) => set((state) => {
        const original = state.outfits.find((o) => o.id === id);
        if (!original) return state;
        return {
          outfits: [
            {
              ...original,
              id: crypto.randomUUID(),
              name: `${original.name} (Copy)`,
              createdAt: new Date().toISOString(),
            },
            ...state.outfits
          ]
        };
      }),
    }),
    {
      name: 'saved-outfits-storage',
      partialize: (state) => ({ outfits: state.outfits }),
      onRehydrateStorage: (state) => {
        return () => state?.setHasHydrated(true);
      }
    }
  )
);
