import axios from 'axios';

// Image storage. Garment pictures go straight from the browser to Cloudinary using an
// UNSIGNED upload preset, so the backend never handles image bytes. The two values
// below are public by design (they end up in the built JavaScript) - the preset
// should be restricted on Cloudinary's side (folder, formats, size).
const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

export const cloudinaryService = {
  // Uploads `file` into the "digital-closet" folder and returns its permanent https URL, which is what gets saved on the garment.
  uploadImage: async (file: File | Blob): Promise<string> => {
    if (!CLOUD_NAME || !UPLOAD_PRESET) {
      throw new Error('Cloudinary configuration is missing. Please check your .env file.');
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', UPLOAD_PRESET);
    formData.append('folder', 'digital-closet');

    try {
      const response = await axios.post(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
        formData
      );
      return response.data.secure_url;
    } catch (error: any) {
      console.error('Cloudinary upload error:', error);
      throw new Error(error.response?.data?.error?.message || 'Failed to upload image to Cloudinary');
    }
  }
};
