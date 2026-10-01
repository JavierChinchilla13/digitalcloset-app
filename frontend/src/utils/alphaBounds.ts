import type { ClothingTransform } from '../types';
import { retargetTransform } from './meshWarp';

// Bounding box of the visible (non-transparent) part of an image - used to fit
// a garment by what is actually drawn rather than by its whole picture, which
// often carries wide transparent margins.

export interface PixelBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

// `data` is RGBA pixel data (as from getImageData). A pixel counts as visible
// when its alpha is above `threshold` (stray near-invisible pixels left by
// anti-aliasing or cutout tools shouldn't stretch the box). Null when nothing
// is visible.
export function alphaBounds(
  data: ArrayLike<number>,
  width: number,
  height: number,
  threshold = 16
): PixelBox | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > threshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX || maxY < minY) return null;
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

// A garment's saved fit (`transform`) describes its WHOLE picture: the virtual
// size of that picture and where its center sits. Cropping the picture to
// `trim` (pixels inside the full picture) must change both so the garment
// looks exactly as before: the size shrinks by the crop ratio, and the center
// moves by how far the crop's center is from the picture's center (rotated
// with the garment, and mirrored when it is flipped). The crop mask is dropped
// (it was framed against the old picture) - see retargetTransform.
export function retargetForTrim(
  transform: ClothingTransform,
  trim: { x: number; y: number; width: number; height: number; fullWidth: number; fullHeight: number }
): ClothingTransform {
  const shift = {
    x: (trim.x + trim.width / 2 - trim.fullWidth / 2) * (transform.flipX ? -1 : 1),
    y: (trim.y + trim.height / 2 - trim.fullHeight / 2) * (transform.flipY ? -1 : 1),
  };
  return retargetTransform(
    transform,
    { width: trim.fullWidth, height: trim.fullHeight },
    { width: trim.width, height: trim.height },
    shift
  );
}

// Grows a box by `fraction` of its own size (at least `minPad` px) on every
// side, without leaving the image.
export function padBox(
  box: PixelBox,
  imageWidth: number,
  imageHeight: number,
  fraction = 0.02,
  minPad = 4
): PixelBox {
  const pad = Math.max(minPad, Math.round(Math.max(box.width, box.height) * fraction));
  const x = Math.max(0, box.x - pad);
  const y = Math.max(0, box.y - pad);
  const right = Math.min(imageWidth, box.x + box.width + pad);
  const bottom = Math.min(imageHeight, box.y + box.height + pad);
  return { x, y, width: right - x, height: bottom - y };
}
