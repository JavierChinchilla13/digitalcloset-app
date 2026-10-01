import { useEffect, useMemo, useState } from 'react';
import { ClothingCategory, PersonaType } from '../types';
import type { PersonaLayerProps } from '../components/PersonaLayer';
import { VIRTUAL_WIDTH, cropInsets, jacketOpening, resolveFinalTransform } from '../utils/layerGeometry';
import { buildMask, clipMode, rowSpans, type Occluder, type RowSpans } from '../utils/occlusion';

// Realistic layering (Task 85) - the canvas side. See utils/occlusion.ts for
// the rules. Each garment is redrawn offscreen with exactly the transform
// PersonaLayer gives it, its per-row extent is measured, and every garment
// that has another one above it gets a mask (a small PNG, used as a CSS
// mask-image on its layer) hiding what a real garment underneath couldn't show.

// Mask resolution: half the 750 x 1000 virtual space in each direction (so one
// virtual unit = SCALE pixels on both axes) is plenty for a silhouette edge,
// and keeps the work small.
const MASK_W = 375;
const MASK_H = 500;
const SCALE = MASK_W / VIRTUAL_WIDTH;

type MaskLayer = PersonaLayerProps & { imageUrl: string; category: ClothingCategory };

const imageCache = new Map<string, Promise<HTMLImageElement | null>>();

// Loaded with CORS so the pixels can be read back; null if it can't be loaded
// (or the host doesn't allow it) - that garment then simply gets no masking.
function loadImage(url: string): Promise<HTMLImageElement | null> {
  let cached = imageCache.get(url);
  if (!cached) {
    cached = new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    });
    imageCache.set(url, cached);
  }
  return cached;
}

// jsdom has no canvas: nothing to compute there (and getContext would log a
// "not implemented" error on every render).
const canvasAvailable = () =>
  typeof document !== 'undefined' && !(typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent));

// Draws one layer into a MASK_W x MASK_H canvas the way PersonaLayer draws it
// with CSS (placed by center, rotated, flipped, cropped, jacket opening cut
// out) and returns its alpha channel.
function layerAlpha(layer: MaskLayer, img: HTMLImageElement): Uint8ClampedArray | null {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = MASK_W;
    canvas.height = MASK_H;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    const t = resolveFinalTransform(layer.transform, layer.category, layer.personaType ?? PersonaType.MALE, layer.side);
    ctx.save();
    if (!t) {
      // No transform: a full-height picture centered in the box.
      const h = MASK_H;
      const w = (img.naturalWidth / img.naturalHeight) * h;
      ctx.drawImage(img, (MASK_W - w) / 2, 0, w, h);
    } else {
      const w = (t.width || 450) * SCALE;
      const h = (t.height || 450) * SCALE;
      ctx.translate(t.x * SCALE, t.y * SCALE);
      ctx.rotate(((t.rotation || 0) * Math.PI) / 180);
      ctx.scale(t.flipX ? -1 : 1, t.flipY ? -1 : 1);
      ctx.translate(-w / 2, -h / 2);

      const crop = cropInsets(t);
      if (crop) {
        ctx.beginPath();
        ctx.rect(
          (crop.left / 100) * w,
          (crop.top / 100) * h,
          w * (1 - (crop.left + crop.right) / 100),
          h * (1 - (crop.top + crop.bottom) / 100)
        );
        ctx.clip();
      }
      ctx.drawImage(img, 0, 0, w, h);

      const opening = jacketOpening(t, layer.category);
      if (opening) {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillRect((opening.start / 100) * w, -h, ((opening.end - opening.start) / 100) * w, h * 3);
      }
    }
    ctx.restore();

    const data = ctx.getImageData(0, 0, MASK_W, MASK_H).data;
    const alpha = new Uint8ClampedArray(MASK_W * MASK_H);
    for (let i = 0; i < alpha.length; i++) alpha[i] = data[i * 4 + 3];
    return alpha;
  } catch {
    // A tainted canvas (the image host sends no CORS headers) can't be read.
    return null;
  }
}

function maskToUrl(mask: Uint8ClampedArray): string | null {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = MASK_W;
    canvas.height = MASK_H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const out = ctx.createImageData(MASK_W, MASK_H);
    for (let i = 0; i < mask.length; i++) out.data[i * 4 + 3] = mask[i]; // black, alpha = visible
    ctx.putImageData(out, 0, 0);
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

interface Garment {
  key: string;
  category: ClothingCategory;
  low: number; // lowest and highest z among its pictures
  high: number;
  layerIds: string[];
  spans: RowSpans;
  alpha: Uint8ClampedArray;
}

// Everything that decides the masks: the garments, where they are and in what
// order. The effect only re-runs when this changes.
const signatureOf = (layers: PersonaLayerProps[]) =>
  JSON.stringify(
    layers
      .filter((l) => l.id !== 'base' && l.imageUrl && l.category)
      .map((l) => [l.id, l.group, l.imageUrl, l.zIndex, l.category, l.side, l.personaType, l.transform])
  );

// Returns { layerId: maskUrl } for every layer that has a garment above it.
export function useOcclusionMasks(layers: PersonaLayerProps[]): Record<string, string> {
  const [masks, setMasks] = useState<Record<string, string>>({});
  const signature = useMemo(() => signatureOf(layers), [layers]);

  useEffect(() => {
    const garmentLayers = layers.filter(
      (l): l is MaskLayer => l.id !== 'base' && !!l.imageUrl && !!l.category
    );
    // Cheap exit: a mask needs at least two garments.
    if (!canvasAvailable() || garmentLayers.length < 2) {
      setMasks((prev) => (Object.keys(prev).length ? {} : prev));
      return;
    }

    let cancelled = false;
    (async () => {
      // 1. Measure every garment (grouping the pictures of a modular jacket).
      const byKey = new Map<string, { layers: MaskLayer[]; alpha: Uint8ClampedArray }>();
      for (const layer of garmentLayers) {
        const img = await loadImage(layer.imageUrl);
        const alpha = img && layerAlpha(layer, img);
        if (!alpha) continue;
        const key = layer.group ?? layer.id;
        const entry = byKey.get(key);
        if (!entry) {
          byKey.set(key, { layers: [layer], alpha });
        } else {
          // The pictures of one garment (a modular jacket's torso, sleeves,
          // ...) are measured together, as one picture.
          entry.layers.push(layer);
          for (let i = 0; i < alpha.length; i++) entry.alpha[i] = Math.max(entry.alpha[i], alpha[i]);
        }
      }
      if (cancelled) return;

      const garments: Garment[] = [];
      byKey.forEach((entry, key) => {
        const spans = rowSpans(entry.alpha, MASK_W, MASK_H);
        if (spans.top < 0) return;
        const zs = entry.layers.map((l) => l.zIndex);
        garments.push({
          key,
          category: entry.layers[0].category,
          low: Math.min(...zs),
          high: Math.max(...zs),
          layerIds: entry.layers.map((l) => l.id),
          spans,
          alpha: entry.alpha,
        });
      });

      // The outline of the trousers / skirts in the outfit (all of them, as
      // one): a top or dress under a jacket shows below the hem only inside it.
      const bottoms = garments.filter((g) => g.category === ClothingCategory.BOTTOM);
      let tuck: RowSpans | null = null;
      if (bottoms.length) {
        const merged = new Uint8ClampedArray(MASK_W * MASK_H);
        for (const g of bottoms) for (let i = 0; i < merged.length; i++) merged[i] = Math.max(merged[i], g.alpha[i]);
        tuck = rowSpans(merged, MASK_W, MASK_H);
      }

      // 2. A mask for each garment that has a clipping garment above it.
      const next: Record<string, string> = {};
      for (const lower of garments) {
        const occluders: Occluder[] = [];
        for (const upper of garments) {
          if (upper === lower || upper.low <= lower.high) continue;
          const mode = clipMode(lower.category, upper.category);
          if (mode) occluders.push({ spans: upper.spans, mode, tuck: mode === 'full' ? tuck : null });
        }
        if (occluders.length === 0) continue;
        const url = maskToUrl(buildMask(occluders, MASK_W, MASK_H));
        if (url) lower.layerIds.forEach((id) => (next[id] = url));
      }
      if (!cancelled) setMasks(next);
    })();

    return () => {
      cancelled = true;
    };
    // `layers` is rebuilt on every render of the caller; `signature` is what
    // actually describes it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  return masks;
}
