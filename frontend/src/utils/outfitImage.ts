import type { ClothingItem, PersonaState } from '../types';
import { PersonaType } from '../types';
import type { PersonaLayerProps } from '../components/PersonaLayer';
import { buildPersonaLayers } from './personaLayers';
import { computeOcclusionMasks, loadImage } from '../hooks/useOcclusionMasks';
import { VIRTUAL_HEIGHT, VIRTUAL_WIDTH, cropInsets, jacketOpening, resolveFinalTransform } from './layerGeometry';

// Task 102: draws an outfit on a canvas and returns it as a PNG, so it can be downloaded or shared as a
// picture. It is the canvas twin of PersonaRenderer: the same layers (buildPersonaLayers), the same
// placement maths (layerGeometry - placed by centre, rotated, flipped, cropped, jacket opening) and the
// same "a jacket hides what is under it" masks (computeOcclusionMasks), so the picture matches the screen.

// A 3:4 portrait, like the persona's own box.
export const EXPORT_WIDTH = 1080;
export const EXPORT_HEIGHT = 1440;

// Thrown when the picture cannot be made (an image host that refuses cross-origin use taints the canvas).
export class OutfitImageError extends Error {}

const BACKGROUND = '#f4f2ee';

// Draws one layer the way PersonaLayer places it with CSS. `scale` is canvas pixels per virtual unit.
function drawLayer(
  ctx: CanvasRenderingContext2D,
  layer: PersonaLayerProps,
  img: HTMLImageElement,
  scale: number,
  width: number
): void {
  const t = resolveFinalTransform(layer.transform, layer.category, layer.personaType ?? PersonaType.MALE, layer.side);
  ctx.save();
  if (!t) {
    // No transform (the base figure): a full-height picture centred in the box.
    const h = VIRTUAL_HEIGHT * scale;
    const w = (img.naturalWidth / img.naturalHeight) * h;
    ctx.drawImage(img, (width - w) / 2, 0, w, h);
  } else {
    const w = (t.width || 450) * scale;
    const h = (t.height || 450) * scale;
    ctx.globalAlpha = t.opacity ?? 1;
    ctx.translate(t.x * scale, t.y * scale);
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
}

function newCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

// Paints the whole outfit onto a new canvas and returns it. `title` is printed small at the top.
export async function renderOutfitToCanvas(
  persona: PersonaState,
  items: ClothingItem[],
  title?: string
): Promise<HTMLCanvasElement> {
  const width = EXPORT_WIDTH;
  const height = EXPORT_HEIGHT;
  const scale = width / VIRTUAL_WIDTH;
  const layers = [...buildPersonaLayers(persona, items)].sort((a, b) => a.zIndex - b.zIndex);
  const masks = (await computeOcclusionMasks(layers)) ?? {};

  const canvas = newCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new OutfitImageError('This browser cannot draw the picture.');

  ctx.fillStyle = BACKGROUND;
  ctx.fillRect(0, 0, width, height);

  for (const layer of layers) {
    if (!layer.imageUrl) continue;
    const img = await loadImage(layer.imageUrl);
    // A garment that cannot be loaded is skipped rather than failing the whole picture.
    if (!img) continue;

    const maskUrl = masks[layer.id];
    const mask = maskUrl ? await loadImage(maskUrl) : null;
    if (mask) {
      // Draw the layer alone, cut it with its mask, then lay the result onto the picture.
      const scratch = newCanvas(width, height);
      const sctx = scratch.getContext('2d');
      if (!sctx) continue;
      drawLayer(sctx, layer, img, scale, width);
      sctx.globalCompositeOperation = 'destination-in';
      sctx.drawImage(mask, 0, 0, width, height);
      ctx.drawImage(scratch, 0, 0);
    } else {
      drawLayer(ctx, layer, img, scale, width);
    }
  }

  // A small mark along the top edge, clear of the figure: where it was made on the left, the outfit's
  // name on the right.
  ctx.fillStyle = 'rgba(20, 20, 20, 0.55)';
  ctx.font = '500 22px "Jost", "Helvetica Neue", Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('V Y S V I', 48, 64);
  if (title) {
    ctx.textAlign = 'right';
    ctx.fillText(title.toUpperCase().slice(0, 28), width - 48, 64);
  }
  return canvas;
}

// The outfit as a PNG file's contents. Rejects with an OutfitImageError when the browser refuses to
// export the picture (a garment host without CORS headers makes the canvas unreadable).
export async function renderOutfitToBlob(
  persona: PersonaState,
  items: ClothingItem[],
  title?: string
): Promise<Blob> {
  const canvas = await renderOutfitToCanvas(persona, items, title);
  return new Promise<Blob>((resolve, reject) => {
    try {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new OutfitImageError('The picture could not be created.'));
      }, 'image/png');
    } catch {
      reject(new OutfitImageError('The picture could not be created from these images.'));
    }
  });
}
