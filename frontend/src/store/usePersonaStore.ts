import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { PersonaType, ClothingCategory, type PersonaState, type ClothingItem } from '../types';

interface PersonaStore {
  persona: PersonaState;
  _hasHydrated: boolean;
  setHasHydrated: (state: boolean) => void;
  setPersonaType: (type: PersonaType) => void;
  updatePersona: (updates: Partial<PersonaState>) => void;
  setEquippedItem: (item: ClothingItem | null) => void;
  clearEquipped: () => void;
}

export const usePersonaStore = create<PersonaStore>()(
  persist(
    (set) => ({
      persona: {
        type: PersonaType.MALE,
        topIds: [],
        bottomIds: [],
        leftShoeId: null,
        rightShoeId: null,
        accessoryIds: [],
        jacketIds: [],
        dressIds: [],
      },
      _hasHydrated: false,
      setHasHydrated: (state) => set({ _hasHydrated: state }),
      setPersonaType: (type) => set((state) => ({ 
        persona: { ...state.persona, type } 
      })),
      updatePersona: (updates) => set((state) => ({ 
        persona: { ...state.persona, ...updates } 
      })),
      setEquippedItem: (item: ClothingItem | null) => set((state) => {
        if (!item) return state;

        const { category, itemId, side } = item;
        const currentPersona = state.persona;

        // 1. Specialized Shoe Logic
        if (category === ClothingCategory.SHOES) {
           // A. If it has a specific side, toggle that specific slot
           if (side === 'left') {
              return { persona: { ...currentPersona, leftShoeId: currentPersona.leftShoeId === itemId ? null : itemId } };
           }
           if (side === 'right') {
              return { persona: { ...currentPersona, rightShoeId: currentPersona.rightShoeId === itemId ? null : itemId } };
           }
           
           // B. Legacy Shoe Handling (No side metadata)
           // If already equipped on either foot, remove from both
           if (currentPersona.leftShoeId === itemId || currentPersona.rightShoeId === itemId) {
              return { persona: { ...currentPersona, leftShoeId: null, rightShoeId: null } };
           }
           
           // If not equipped, try to find an empty slot
           if (!currentPersona.leftShoeId) {
              return { persona: { ...currentPersona, leftShoeId: itemId } };
           }
           if (!currentPersona.rightShoeId) {
              return { persona: { ...currentPersona, rightShoeId: itemId } };
           }
           
           // If both slots are full with OTHER shoes, replace the left one (default)
           return { persona: { ...currentPersona, leftShoeId: itemId } };
        }

        // 2. Multiple Items for other categories
        const keyMap: Record<string, keyof PersonaState> = {
          [ClothingCategory.TOP]: 'topIds',
          [ClothingCategory.BOTTOM]: 'bottomIds',
          [ClothingCategory.JACKET]: 'jacketIds',
          [ClothingCategory.DRESS]: 'dressIds',
          [ClothingCategory.ACCESSORY]: 'accessoryIds',
        };

        const key = keyMap[category];
        if (!key) return state;

        const currentIds = (currentPersona[key] as number[]) || [];
        const isEquipped = currentIds.includes(itemId);
        
        let newIds = isEquipped 
          ? currentIds.filter(id => id !== itemId)
          : [...currentIds, itemId];

        // 3. Logical Overrides (Dress vs Top/Bottom)
        let overrides: Partial<PersonaState> = {};
        if (category === ClothingCategory.DRESS && !isEquipped) {
          overrides.topIds = [];
          overrides.bottomIds = [];
        } else if ((category === ClothingCategory.TOP || category === ClothingCategory.BOTTOM) && !isEquipped) {
          overrides.dressIds = [];
        }

        return {
          persona: { 
            ...currentPersona, 
            ...overrides,
            [key]: newIds 
          }
        };
      }),
      clearEquipped: () => set((state) => ({
        persona: {
          ...state.persona,
          topIds: [],
          bottomIds: [],
          leftShoeId: null,
          rightShoeId: null,
          accessoryIds: [],
          jacketIds: [],
          dressIds: [],
        }
      })),
    }),
    {
      name: 'persona-storage',
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      }
    }
  )
);
