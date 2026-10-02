import type { IBgRemover, BgRemoverOptions } from "./types";

// Background removal through the optional Python service (backend-ai/, rembg). Used
// when VITE_BG_REMOVER_MODE is 'api', or as the fallback in 'hybrid'. The default URL
// is the local dev server; set VITE_BG_REMOVER_API_URL for a deployed one.
const API_URL = import.meta.env.VITE_BG_REMOVER_API_URL || 'http://localhost:8000/remove-bg';

export class ApiBgRemover implements IBgRemover {
  // POSTs the image and returns an object URL of the transparent PNG. The caller owns (and should revoke) that URL.
  async removeBackground(file: File, options?: BgRemoverOptions): Promise<string> {
    console.log('Using API Background Remover (FastAPI/rembg)');
    
    if (options?.onProgress) options.onProgress('Uploading to AI server...');

    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(API_URL, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`API background removal failed: ${response.statusText}`);
    }

    const blob = await response.blob();
    return URL.createObjectURL(blob);
  }
}
