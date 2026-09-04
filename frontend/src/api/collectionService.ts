import api from './axios';
import type { Collection } from '../types';

// Mirrors clothingService/outfitService's pattern. Backend endpoints from
// Tasks 33-34 (CollectionController) - create/rename both just send
// { name }, matching CollectionRequest's single-field shape.
export const collectionService = {
  getCollections: async (): Promise<Collection[]> => {
    const response = await api.get<Collection[]>('/collections');
    return response.data;
  },

  createCollection: async (name: string): Promise<Collection> => {
    const response = await api.post<Collection>('/collections', { name });
    return response.data;
  },

  renameCollection: async (collectionId: number, name: string): Promise<Collection> => {
    const response = await api.put<Collection>(`/collections/${collectionId}`, { name });
    return response.data;
  },

  deleteCollection: async (collectionId: number): Promise<void> => {
    await api.delete(`/collections/${collectionId}`);
  },

  addItemToCollection: async (collectionId: number, itemId: number): Promise<Collection> => {
    const response = await api.post<Collection>(`/collections/${collectionId}/items/${itemId}`);
    return response.data;
  },

  removeItemFromCollection: async (collectionId: number, itemId: number): Promise<Collection> => {
    const response = await api.delete<Collection>(`/collections/${collectionId}/items/${itemId}`);
    return response.data;
  },

  addOutfitToCollection: async (collectionId: number, outfitId: number): Promise<Collection> => {
    const response = await api.post<Collection>(`/collections/${collectionId}/outfits/${outfitId}`);
    return response.data;
  },

  removeOutfitFromCollection: async (collectionId: number, outfitId: number): Promise<Collection> => {
    const response = await api.delete<Collection>(`/collections/${collectionId}/outfits/${outfitId}`);
    return response.data;
  },
};
