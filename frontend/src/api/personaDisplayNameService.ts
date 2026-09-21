import api from './axios';
import type { PersonaType } from '../types';

export interface PersonaDisplayName {
  personaType: PersonaType;
  displayName: string;
}

// Task 60, Phase 9.5: mirrors collectionService.ts's pattern. Only ever
// returns/accepts overrides - a persona type with no row here falls back
// to usePersonaSettingsStore's own default ("M Persona"/"F Persona").
export const personaDisplayNameService = {
  getAll: async (): Promise<PersonaDisplayName[]> => {
    const response = await api.get<PersonaDisplayName[]>('/persona-display-names');
    return response.data;
  },

  upsert: async (personaType: PersonaType, displayName: string): Promise<PersonaDisplayName> => {
    const response = await api.put<PersonaDisplayName>(`/persona-display-names/${personaType}`, { displayName });
    return response.data;
  },

  reset: async (personaType: PersonaType): Promise<void> => {
    await api.delete(`/persona-display-names/${personaType}`);
  },
};
