import api from './axios';
import type { Outfit, OutfitRequest } from '../types';

// OutfitRequest is defined once in ../types (Task 15) - it used to be
// duplicated here with a slightly different, stricter shape.

export const outfitService = {
  getOutfits: async (): Promise<Outfit[]> => {
    const response = await api.get<Outfit[]>('/outfits');
    return response.data;
  },

  getOutfit: async (outfitId: number): Promise<Outfit> => {
    const response = await api.get<Outfit>(`/outfits/${outfitId}`);
    return response.data;
  },

  createOutfit: async (data: OutfitRequest): Promise<Outfit> => {
    const response = await api.post<Outfit>('/outfits', data);
    return response.data;
  },

  updateOutfit: async (outfitId: number, data: OutfitRequest): Promise<Outfit> => {
    const response = await api.put<Outfit>(`/outfits/${outfitId}`, data);
    return response.data;
  },

  deleteOutfit: async (outfitId: number): Promise<void> => {
    await api.delete(`/outfits/${outfitId}`);
  }
};
