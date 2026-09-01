import { removeBackground } from "@imgly/background-removal";
import type { IBgRemover, BgRemoverOptions } from "./types";

export class BrowserBgRemover implements IBgRemover {
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
