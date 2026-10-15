import type { BgRemoverOptions } from '../lib/background-removers/types';

// Task 100: the heavy in-browser image services (background removal, jacket segmentation) pull in
// large model runtimes. They are loaded with a dynamic import() at the moment they are used, so the
// code is only downloaded when someone really uploads or edits a garment - never on the landing page
// or the closet grid. The wrappers keep the call sites as simple as the old static imports.

// Removes the background of an image file (browser model first, then the API, then the original).
export const removeBackground = async (file: File, options?: BgRemoverOptions) => {
  const { bgRemovalService } = await import('../lib/background-removers');
  return bgRemovalService.removeBackground(file, options);
};

// Shrinks an image file to a sensible size before it is processed or uploaded.
export const optimizeImage = async (file: File): Promise<File> => {
  const mod = await import('../lib/background-removers');
  return mod.optimizeImage(file);
};

// Splits a jacket picture into its sections (body, sleeves, ...) with the in-browser model.
export const segmentJacket = async (file: File) => {
  const { segmentationService } = await import('./segmentationService');
  return segmentationService.segmentJacket(file);
};
