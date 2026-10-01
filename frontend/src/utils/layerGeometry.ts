import { ClothingCategory, PersonaType, type ClothingTransform } from '../types';
import { DEFAULT_TRANSFORMS, SHOE_PAIR_PRESETS } from '../components/FittingTool/Presets';

// How a garment layer is placed on the persona, shared by PersonaLayer (which
// draws it with CSS) and the occlusion masks (which redraw it offscreen), so
// both always agree on where a garment is.

// The virtual space every transform lives in (see CanvasUtils).
export const VIRTUAL_WIDTH = 750;
export const VIRTUAL_HEIGHT = 1000;

// The transform a layer is actually drawn with: its own when it has a size,
// else the category's preset (shoes: the left/right pair preset), else null
// (drawn as a full-height picture).
export function resolveFinalTransform(
  transform: ClothingTransform | undefined,
  category: ClothingCategory | undefined,
  personaType: PersonaType,
  side?: 'left' | 'right'
): ClothingTransform | null {
  if (transform?.width) return transform;
  if (!category) return null;
  if (category === ClothingCategory.SHOES && side) return SHOE_PAIR_PRESETS[personaType][side];
  return DEFAULT_TRANSFORMS[personaType][category] ?? null;
}

// Crop, as inset percentages of the garment's own box (top/right/bottom/left),
// or null when the garment isn't cropped. maskLeft/maskTop are the crop's
// CENTER (they come from Fabric's clipPath with originX/Y 'center'), like x/y.
export function cropInsets(
  t: ClothingTransform
): { top: number; right: number; bottom: number; left: number } | null {
  if (!t.maskWidth || !t.maskHeight) return null;
  const gW = t.width || 450;
  const gH = t.height || 450;
  const gLeft = t.x - gW / 2;
  const gTop = t.y - gH / 2;

  const maskLeftEdge = t.maskLeft! - t.maskWidth / 2;
  const maskTopEdge = t.maskTop! - t.maskHeight / 2;
  const maskRightEdge = t.maskLeft! + t.maskWidth / 2;
  const maskBottomEdge = t.maskTop! + t.maskHeight / 2;

  return {
    top: Math.max(0, ((maskTopEdge - gTop) / gH) * 100),
    right: Math.max(0, 100 - ((maskRightEdge - gLeft) / gW) * 100),
    bottom: Math.max(0, 100 - ((maskBottomEdge - gTop) / gH) * 100),
    left: Math.max(0, ((maskLeftEdge - gLeft) / gW) * 100),
  };
}

// A jacket's centre opening, as the start/end of the hole in percent of its
// width, or null when it is closed (or not a jacket).
export function jacketOpening(
  t: ClothingTransform,
  category: ClothingCategory | undefined
): { start: number; end: number } | null {
  if (category !== ClothingCategory.JACKET || !t.openness) return null;
  return { start: 50 - (t.openness * 100) / 2, end: 50 + (t.openness * 100) / 2 };
}
