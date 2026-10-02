import { useEffect, useState } from 'react';
import { alphaBounds } from '../utils/alphaBounds';
import type { PictureRegion } from '../utils/cropDisplay';

// Task 87: where a garment's picture actually shows something. Thumbnails use
// it to fit the garment (not the picture, with whatever transparent margin it
// has) into the card - see CroppedThumbnail.

export interface VisibleBounds {
  region: PictureRegion; // fractions of the picture
  width: number; // the picture's pixel size
  height: number;
}

// Scan a small copy: a thumbnail doesn't need the full-resolution pixels.
const SCAN_SIDE = 128;
// A little higher than alphaBounds' default so a faint shadow / halo around a
// cutout doesn't stretch the box.
const THRESHOLD = 32;

const pending = new Map<string, Promise<VisibleBounds | null>>();
const settled = new Map<string, VisibleBounds | null>();

// jsdom has no canvas (and would log "not implemented"): nothing to measure.
const canMeasure = () =>
  typeof document !== 'undefined' && !(typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent));

function measure(url: string): Promise<VisibleBounds | null> {
  let promise = pending.get(url);
  if (!promise) {
    promise = new Promise<VisibleBounds | null>((resolve) => {
      const img = new Image();
      // Needed to read the pixels back; a host without CORS headers just
      // fails here and the thumbnail keeps its whole-picture fallback.
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const shrink = Math.min(1, SCAN_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
          const w = Math.max(1, Math.round(img.naturalWidth * shrink));
          const h = Math.max(1, Math.round(img.naturalHeight * shrink));
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) return resolve(null);
          ctx.drawImage(img, 0, 0, w, h);
          const box = alphaBounds(ctx.getImageData(0, 0, w, h).data, w, h, THRESHOLD);
          if (!box) return resolve(null); // fully transparent
          resolve({
            region: { left: box.x / w, top: box.y / h, width: box.width / w, height: box.height / h },
            width: img.naturalWidth,
            height: img.naturalHeight,
          });
        } catch {
          resolve(null); // a tainted canvas, etc.
        }
      };
      img.onerror = () => resolve(null);
      img.src = url;
    }).then((result) => {
      settled.set(url, result);
      return result;
    });
    pending.set(url, promise);
  }
  return promise;
}

// The visible bounds of `imageUrl`, or null while they are being measured (and
// for good if they can't be). Remembered per URL, so a card that remounts
// (scrolling, filtering) doesn't flash its fallback.
export function useVisibleBounds(imageUrl: string): VisibleBounds | null {
  const [bounds, setBounds] = useState<VisibleBounds | null>(() => settled.get(imageUrl) ?? null);

  useEffect(() => {
    if (!canMeasure()) return;
    if (settled.has(imageUrl)) {
      setBounds(settled.get(imageUrl) ?? null);
      return;
    }
    let cancelled = false;
    setBounds(null);
    measure(imageUrl).then((result) => {
      if (!cancelled) setBounds(result);
    });
    return () => {
      cancelled = true;
    };
  }, [imageUrl]);

  return bounds;
}
