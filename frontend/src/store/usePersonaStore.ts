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

        // 1. Specialized Shoe Logic - one shoe per foot (Task 86). A shoe with
        // a side takes that foot (swapping what was there); one without a side
        // is a single picture of the pair and takes both feet.
        const { leftShoeId, rightShoeId } = currentPersona;
        if (category === ClothingCategory.SHOES) {
          if (side === 'left' || side === 'right') {
            const own = side === 'left' ? leftShoeId : rightShoeId;
            const other = side === 'left' ? rightShoeId : leftShoeId;
            // Taking a foot from a pair leaves the pair's other foot empty (it
            // was the same picture, now gone), not stuck on the old pair.
            const otherFoot = other != null && other === own ? null : other;
            const next = own === itemId ? null : itemId;
            return {
              persona: {
                ...currentPersona,
                leftShoeId: side === 'left' ? next : otherFoot,
                rightShoeId: side === 'right' ? next : otherFoot,
              },
            };
          }

          // No side: toggles the pair off if it is already on either foot,
          // otherwise replaces whatever is on both feet.
          if (leftShoeId === itemId || rightShoeId === itemId) {
            return { persona: { ...currentPersona, leftShoeId: null, rightShoeId: null } };
          }
          return { persona: { ...currentPersona, leftShoeId: itemId, rightShoeId: itemId } };
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
          layerOrder: undefined,
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
