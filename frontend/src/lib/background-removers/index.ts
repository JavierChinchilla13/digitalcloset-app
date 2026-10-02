import { BrowserBgRemover } from "./browser";
import { ApiBgRemover } from "./api";
import type { BgRemoverMode, BgRemoverOptions, BgRemoverResult } from "./types";
import imageCompression from 'browser-image-compression';

// Entry point of background removal: picks the method by VITE_BG_REMOVER_MODE
// (default 'hybrid') and never leaves the user stuck - if every method fails the
// original picture is returned so the upload can continue.
const DEFAULT_MODE: BgRemoverMode = (import.meta.env.VITE_BG_REMOVER_MODE as BgRemoverMode) || 'hybrid';

/**
 * Optimizes an image file before processing
 */
export const optimizeImage = async (file: File): Promise<File> => {
  const options = {
    maxWidthOrHeight: 1500,
    useWebWorker: true,
    fileType: 'image/png' as string,
  };
  try {
    return await imageCompression(file, options);
  } catch (error) {
    console.error('Image optimization failed:', error);
    return file;
  }
};

// Tries the configured removers in order (browser, then API) and falls back to the original image.
export class BackgroundRemovalService {
  private browserRemover = new BrowserBgRemover();
  private apiRemover = new ApiBgRemover();

  async removeBackground(file: File, options?: BgRemoverOptions): Promise<BgRemoverResult> {
    const mode = options?.mode || DEFAULT_MODE;
    const optimizedFile = await optimizeImage(file);

    // Hybrid or Browser-only
    if (mode === 'hybrid' || mode === 'browser') {
      try {
        const url = await this.browserRemover.removeBackground(optimizedFile, options);
        return { url, method: 'browser' };
      } catch (err) {
        console.warn('Browser background removal failed, checking fallback...', err);
        if (mode === 'browser') throw err;
      }
    }

    // Hybrid or API-only
    if (mode === 'hybrid' || mode === 'api') {
      try {
        const url = await this.apiRemover.removeBackground(optimizedFile, options);
        return { url, method: 'api' };
      } catch (err) {
        console.error('API background removal failed:', err);
        if (mode === 'api') throw err;
      }
    }

    // Final Fallback: Original Image
    console.warn('All background removal methods failed or skipped. Returning original.');
    if (options?.onProgress) options.onProgress('AI unavailable. Using original image.');
    const originalUrl = URL.createObjectURL(optimizedFile);
    return { url: originalUrl, method: 'original' };
  }
}

export const bgRemovalService = new BackgroundRemovalService();
