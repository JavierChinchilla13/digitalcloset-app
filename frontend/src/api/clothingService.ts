import api from './axios';
import { ClothingCategory } from '../types';
import type { ClothingItem } from '../types';

// The garment endpoints (ClothingController, /api/clothing). A thin wrapper: every
// call returns the response body, and errors propagate to the store that called it.
// Note: getClothingItem is unused and the backend has no GET /clothing/{id} - the
// closet is always loaded as a list (useClothingStore.fetchItems).
export const clothingService = {
  // All of the user's active garments. `category` is sent as a query parameter, but
// ClothingController.getAllItems ignores it and returns everything, so filter on the
// client (the closet pages already do).
  getClothingItems: async (category?: ClothingCategory): Promise<ClothingItem[]> => {
    const params = category ? { category } : {};
    const response = await api.get<ClothingItem[]>('/clothing', { params });
    return response.data;
  },

  getClothingItem: async (itemId: number): Promise<ClothingItem> => {
    const response = await api.get<ClothingItem>(`/clothing/${itemId}`);
    return response.data;
  },

  // Saves a new garment. `data.imageUrl` is the Cloudinary URL (see cloudinaryService); the backend never receives the image itself.
  createClothingItem: async (data: Omit<ClothingItem, 'itemId'>): Promise<ClothingItem> => {
    const response = await api.post<ClothingItem>('/clothing', data);
    return response.data;
  },

  // Partial update: only the fields present in `data` change (ClothingService.updateItem skips nulls).
  updateClothingItem: async (itemId: number, data: Partial<ClothingItem>): Promise<ClothingItem> => {
    const response = await api.put<ClothingItem>(`/clothing/${itemId}`, data);
    return response.data;
  },

  // Soft delete on the server (the row is kept with active=false).
  deleteClothingItem: async (itemId: number): Promise<void> => {
    await api.delete(`/clothing/${itemId}`);
  }
};
