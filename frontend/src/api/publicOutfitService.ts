import axios from 'axios';
import { API_BASE_URL } from './axios';
import type { ClothingCategory, PersonaStatus, PersonaType, ClothingTransform } from '../types';

// Task 102: reads a shared outfit by its public token. Uses its own bare axios instance on purpose:
// the app's main instance attaches the visitor's token and logs them out on a 401, and a public page
// must do neither (a signed-in visitor with an expired session still just sees the outfit).
const publicApi = axios.create({ baseURL: API_BASE_URL, timeout: 60000 });

export interface PublicGarment {
  itemId: number;
  name: string;
  category: ClothingCategory;
  imageUrl: string;
  side?: 'left' | 'right';
  isModular?: boolean;
  modularData?: string;
  personaType: PersonaType;
  transform: ClothingTransform;
  personaStatus?: PersonaStatus;
}

export interface PublicOutfit {
  name: string;
  avatarType: PersonaType;
  items: { itemId: number; slot?: string; itemOrder?: number; layerOrder?: number | null }[];
  garments: PublicGarment[];
}

export const publicOutfitService = {
  getByToken: async (token: string): Promise<PublicOutfit> => {
    const response = await publicApi.get<PublicOutfit>(`/public/outfits/${encodeURIComponent(token)}`);
    return response.data;
  },
};
