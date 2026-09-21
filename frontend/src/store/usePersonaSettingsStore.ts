import { create } from 'zustand';
import { PersonaType } from '../types';
import { personaDisplayNameService } from '../api/personaDisplayNameService';

// Task 60, Phase 9.5: persona display names - deliberately a separate
// store from usePersonaStore.ts. That store's persona.type is the
// *selection* (which persona is active), purely local/localStorage-
// persisted; this is the *display name* for each persona type,
// backend-synced (Open Question #21's resolution). Conflating them would
// mean every persona.type change triggers a network round-trip that has
// nothing to do with picking a persona.
const DEFAULT_DISPLAY_NAMES: Record<PersonaType, string> = {
  [PersonaType.MALE]: 'M Persona',
  [PersonaType.FEMALE]: 'F Persona',
};

interface PersonaSettingsState {
  // Only overrides - a persona type with no entry here uses
  // DEFAULT_DISPLAY_NAMES, applied in getDisplayName below rather than
  // pre-filled into this map, so "has the user customized this" stays
  // distinguishable from "happens to match the default".
  displayNames: Partial<Record<PersonaType, string>>;
  isLoading: boolean;
  fetchDisplayNames: () => Promise<void>;
  getDisplayName: (type: PersonaType) => string;
  setDisplayName: (type: PersonaType, name: string) => Promise<void>;
  resetDisplayName: (type: PersonaType) => Promise<void>;
}

export const usePersonaSettingsStore = create<PersonaSettingsState>((set, get) => ({
  displayNames: {},
  isLoading: false,

  fetchDisplayNames: async () => {
    set({ isLoading: true });
    try {
      const rows = await personaDisplayNameService.getAll();
      const displayNames: Partial<Record<PersonaType, string>> = {};
      rows.forEach((row) => {
        displayNames[row.personaType] = row.displayName;
      });
      set({ displayNames, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  getDisplayName: (type) => get().displayNames[type] ?? DEFAULT_DISPLAY_NAMES[type],

  setDisplayName: async (type, name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    await personaDisplayNameService.upsert(type, trimmed);
    set((state) => ({ displayNames: { ...state.displayNames, [type]: trimmed } }));
  },

  resetDisplayName: async (type) => {
    await personaDisplayNameService.reset(type);
    set((state) => {
      const next = { ...state.displayNames };
      delete next[type];
      return { displayNames: next };
    });
  },
}));
