import type { ClothingTransform } from '../types';

export interface CropDisplay {
  // Aspect ratio (width / height) the visible cropped region has when
  // displayed - the box the crop is drawn into must have this exact ratio,
  // otherwise scaling the image to fill it would stretch it.
  aspectRatio: number;
  backgroundSize: string;
  backgroundPosition: string;
}

/**
 * Computes how to show only the cropped region of an item's image in a flat
 * card/grid thumbnail (see CroppedThumbnail) - a plain `<img>`/`object-cover`
 * always shows the full original photo since it never looks at
 * `transform.mask*`. Returns null when the item has no (meaningful) crop.
 *
 * `maskLeft/maskTop` are the crop's CENTER and `x/y` the garment's CENTER
 * (same Fabric `originX/Y: 'center'` convention, see PersonaLayer), so the
 * crop's fraction of the garment's own bounding box is
 * `maskWidth/width` x `maskHeight/height` - and since the garment is the
 * source image at some (possibly non-uniform) display scale, that's the same
 * fraction of the source image.
 *
 * The caller must draw this into a box whose aspect ratio equals
 * `aspectRatio` (= maskWidth/maskHeight, the crop's displayed proportions).
 * In such a box, scaling the whole image to `100/fw % x 100/fh %` and
 * positioning its crop region's top-left at the box origin reproduces the
 * crop exactly with no distortion (the rendered image's own aspect works out
 * to width/height, i.e. exactly what the editor and persona show). An
 * earlier version instead stretched the crop to fill an arbitrary card
 * shape, which distorted the image whenever the card's proportions differed
 * from the crop's; sizing the box to the crop and letting the card contain
 * it (like the other, uncropped garments) avoids that.
 */
export function getCropDisplay(transform?: ClothingTransform): CropDisplay | null {
  const { maskLeft, maskTop, maskWidth, maskHeight, width, height, x, y } = transform ?? {};

  if (
    !maskWidth || !maskHeight || !width || !height ||
    maskLeft === undefined || maskTop === undefined || x === undefined || y === undefined
  ) {
    return null;
  }

  const fw = Math.min(Math.max(maskWidth / width, 0.02), 1);
  const fh = Math.min(Math.max(maskHeight / height, 0.02), 1);

  // Crop covers ~the whole image - nothing worth cropping to.
  if (fw >= 0.98 && fh >= 0.98) return null;

  // Left/top edge of the crop as a fraction of the garment's box, clamped
  // (a mask can overshoot the garment's bounds by a sub-pixel amount).
  const fl = Math.min(Math.max((maskLeft - maskWidth / 2 - (x - width / 2)) / width, 0), 1 - fw);
  const ft = Math.min(Math.max((maskTop - maskHeight / 2 - (y - height / 2)) / height, 0), 1 - fh);

  return displayForRegion({ left: fl, top: ft, width: fw, height: fh }, maskWidth / maskHeight);
}

// A region of a picture, as fractions (0..1) of the picture's own width/height.
export interface PictureRegion {
  left: number;
  top: number;
  width: number;
  height: number;
}

// Shows `region` of a picture in a box whose aspect ratio is `aspectRatio`
// (the region's own proportions): scale the whole picture to
// `100/width % x 100/height %` and put the region's top-left at the box origin.
function displayForRegion(region: PictureRegion, aspectRatio: number): CropDisplay {
  const { left, top, width: fw, height: fh } = region;
  // background-position percentages map 0%..100% onto the overflow
  // (image size - box size); a dimension with no overflow (fw or fh == 1)
  // has nothing to position.
  const posX = fw >= 0.999 ? 0 : (left / (1 - fw)) * 100;
  const posY = fh >= 0.999 ? 0 : (top / (1 - fh)) * 100;

  return {
    aspectRatio,
    backgroundSize: `${100 / fw}% ${100 / fh}%`,
    backgroundPosition: `${posX}% ${posY}%`,
  };
}

/**
 * Task 87: the same fit for an UNCROPPED garment, using the part of its picture
 * that is actually visible (see hooks/useVisibleBounds). A picture with wide
 * transparent margins, a tightly trimmed one and a full-bleed photo then all
 * end up filling their card the same way - instead of `cover` zooming and
 * clipping some while others float small. `pictureWidth/Height` are the
 * picture's pixel size (the region's own aspect ratio depends on them).
 */
export function getVisibleDisplay(
  region: PictureRegion,
  pictureWidth: number,
  pictureHeight: number
): CropDisplay | null {
  if (pictureWidth <= 0 || pictureHeight <= 0 || region.width <= 0 || region.height <= 0) return null;
  const aspectRatio = (region.width * pictureWidth) / (region.height * pictureHeight);
  return displayForRegion(region, aspectRatio);
}
