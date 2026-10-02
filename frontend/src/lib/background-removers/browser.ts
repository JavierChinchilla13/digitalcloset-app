import { removeBackground } from "@imgly/background-removal";
import type { IBgRemover, BgRemoverOptions } from "./types";

// Background removal inside the visitor's browser (@imgly/background-removal, a WASM
// model run in a web worker) - no server needed, which is why production deploys
// without the Python service. The first use downloads the model files.
export class BrowserBgRemover implements IBgRemover {
  // Returns an object URL of the transparent PNG; reports progress as text through options.onProgress.
  async removeBackground(file: File, options?: BgRemoverOptions): Promise<string> {
    console.log('Using Browser Background Remover (@imgly)');
    
    const config: any = {
      progress: (_key: string, current: number, total: number) => {
        const percentage = Math.round((current / total) * 100);
        const status = `Removing background (Browser): ${percentage}%`;
        if (options?.onProgress) options.onProgress(status);
      },
      model: 'medium',
      proxyToWorker: true,
    };

    const blob = await removeBackground(file, config);
    return URL.createObjectURL(blob);
  }
}
