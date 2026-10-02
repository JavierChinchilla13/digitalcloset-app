// Shared types of the background-removal layer. 'browser' = only in-browser,
// 'api' = only the Python service, 'hybrid' = browser first, then the service.
export type BgRemoverMode = 'browser' | 'api' | 'hybrid';

export interface BgRemoverOptions {
  onProgress?: (status: string) => void;
  mode?: BgRemoverMode;
}

// What was returned and how it was obtained - 'original' means every method failed and the untouched picture is used.
export interface BgRemoverResult {
  url: string;
  method: 'browser' | 'api' | 'original';
}

// One background-removal method. Implementations resolve with an object URL of the transparent image.
export interface IBgRemover {
  removeBackground(file: File, options?: BgRemoverOptions): Promise<string>;
}
