import api from './axios';
import type { ClothingItem } from '../types';

// The garment endpoints (ClothingController, /api/clothing). A thin wrapper: every
// call returns the response body, and errors propagate to the store that called it.
export const clothingService = {
  // All of the user's active garments. The closet is always loaded as one list and
  // filtered on the client (the closet pages do), so there is no category parameter.
  getClothingItems: async (): Promise<ClothingItem[]> => {
    const response = await api.get<ClothingItem[]>('/clothing');
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
