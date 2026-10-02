import { ClothingCategory } from '../types';

// Realistic layering (Task 85). Drawn one over the other, garments just stack,
// so a shirt wider or longer than the jacket over it pokes out at the sides and
// the hem - which a real shirt under a real jacket can't do. Each lower garment
// gets a mask, built from the garments above it:
//  - across the rows an upper garment covers, the lower one is only visible
//    between the upper one's left and right edges (its "outline");
//  - for a top or dress under a JACKET, rows above the jacket and below its
//    BODY hide the lower garment completely too: it is only ever seen through
//    the jacket's opening. (Sleeves can hang lower than the body; the space
//    between their cuffs is not "inside" the jacket.)
// Anything else (pants over a shirt, a shirt over pants, pants over shoes) is
// clipped only across the rows the upper garment covers, so what hangs beyond
// it stays visible.
//
// Everything here works on plain pixel data so it can be tested without a
// browser; the canvas work lives in hooks/useOcclusionMasks.

// Per-row extent of a garment: for each pixel row, the leftmost and rightmost
// visible column (-1 when the row is empty) and the first / last row with any.
export interface RowSpans {
  width: number;
  height: number;
  min: Int16Array;
  max: Int16Array;
  top: number; // -1 when the garment is empty
  bottom: number;
  // Last row that has anything in the garment's central half (its body, not
  // its sleeves, which hang to the sides and can reach lower than the hem).
  bodyBottom: number;
  // For each column, the last row with anything in it (-1 when empty): the
  // garment's own bottom edge, which follows a slanted hem.
  colBottom: Int16Array;
}

// `alpha` is one byte per pixel (width * height). A pixel counts as visible
// above `threshold`. Rows are measured edge to edge, NOT filled: an open
// jacket front or a gap between sleeve and body stays inside the span, which
// is what lets the shirt show through the opening.
export function rowSpans(alpha: ArrayLike<number>, width: number, height: number, threshold = 16): RowSpans {
  const min = new Int16Array(height).fill(-1);
  const max = new Int16Array(height).fill(-1);
  let top = -1;
  let bottom = -1;
  for (let y = 0; y < height; y++) {
    const row = y * width;
    let lo = -1;
    let hi = -1;
    for (let x = 0; x < width; x++) {
      if (alpha[row + x] > threshold) {
        if (lo < 0) lo = x;
        hi = x;
      }
    }
    if (lo >= 0) {
      min[y] = lo;
      max[y] = hi;
      if (top < 0) top = y;
      bottom = y;
    }
  }
  const colBottom = new Int16Array(width).fill(-1);
  for (let x = 0; x < width; x++) {
    for (let y = bottom; y >= top && top >= 0; y--) {
      if (alpha[y * width + x] > threshold) {
        colBottom[x] = y;
        break;
      }
    }
  }
  return {
    width,
    height,
    min,
    max,
    top,
    bottom,
    bodyBottom: bodyBottomRow(alpha, width, min, max, top, bottom, threshold),
    colBottom,
  };
}

// How far down the lower garment may show in each column when it is under a
// jacket: down to the jacket's own bottom edge there (never past the body's
// bottom, so sleeve cuffs hanging lower don't count). Columns with nothing in
// them - the gap of an open front - follow the edge on either side of the gap
// in a straight line.
export function columnLimits(spans: RowSpans): Int16Array {
  const { width, colBottom, bodyBottom } = spans;
  const limits = new Int16Array(width).fill(bodyBottom);
  let prev = -1;
  for (let x = 0; x < width; x++) {
    if (colBottom[x] < 0) continue;
    const here = Math.min(colBottom[x], bodyBottom);
    limits[x] = here;
    if (prev >= 0 && x - prev > 1) {
      const from = limits[prev];
      for (let g = prev + 1; g < x; g++) {
        limits[g] = Math.round(from + ((here - from) * (g - prev)) / (x - prev));
      }
    }
    prev = x;
  }
  return limits;
}

// Scans up from the bottom for the first row with anything in the central half
// of the garment's width.
function bodyBottomRow(
  alpha: ArrayLike<number>,
  width: number,
  min: Int16Array,
  max: Int16Array,
  top: number,
  bottom: number,
  threshold: number
): number {
  if (top < 0) return -1;
  let left = width;
  let right = -1;
  for (let y = top; y <= bottom; y++) {
    if (min[y] >= 0) {
      left = Math.min(left, min[y]);
      right = Math.max(right, max[y]);
    }
  }
  const quarter = (right - left + 1) / 4;
  const from = Math.floor(left + quarter);
  const to = Math.ceil(right - quarter);
  for (let y = bottom; y >= top; y--) {
    const row = y * width;
    for (let x = from; x <= to; x++) {
      if (alpha[row + x] > threshold) return y;
    }
  }
  return bottom;
}

// Whether `upper`, drawn over `lower`, should clip it, and how.
//  'full': the lower garment is only visible inside the upper one's outline,
//          rows above and below it included (top / dress under a jacket);
//  'rows': only the rows the upper garment covers are clipped;
//  null:   no clipping (plain stacking).
// Accessories never clip or get clipped (a watch or a scarf is allowed to sit
// over or poke out of anything), and shoes never clip what is under them
// (trousers hanging over the shoes are allowed to be wider than the shoes).
export type ClipMode = 'full' | 'rows' | null;

const UPPER_BODY = new Set<ClothingCategory>([ClothingCategory.TOP, ClothingCategory.DRESS, ClothingCategory.JACKET]);

export function clipMode(lower: ClothingCategory | undefined, upper: ClothingCategory | undefined): ClipMode {
  if (!lower || !upper) return null;
  if (lower === ClothingCategory.ACCESSORY || upper === ClothingCategory.ACCESSORY) return null;
  if (upper === ClothingCategory.SHOES) return null;
  if (upper === ClothingCategory.JACKET && (lower === ClothingCategory.TOP || lower === ClothingCategory.DRESS)) {
    return 'full';
  }
  // Upper-body pieces under another upper-body piece (a jacket under a shirt, a
  // shirt under a dress, two shirts) just stack: the sleeves come out beside
  // the piece on top, so clipping the lower one to the upper one's outline
  // would wrongly cut its sleeves off.
  if (UPPER_BODY.has(lower) && UPPER_BODY.has(upper)) return null;
  return 'rows';
}

export interface Occluder {
  spans: RowSpans;
  mode: 'full' | 'rows';
  // 'full' only: the outline of the trousers / skirt in the outfit. Below the
  // jacket's hem the shirt or dress shows again, but only inside that outline
  // (a tucked-in look): otherwise the gap between the hem and the trousers
  // would show the persona's own waistband as a stray line.
  tuck?: RowSpans | null;
}

// The mask for a lower garment: one byte per pixel, 255 where it stays visible
// and 0 where an upper garment hides it. With several uppers a pixel must be
// allowed by all of them. `pad` widens each row's span slightly so the edge
// of the upper garment's own anti-aliased outline isn't shaved off.
export function buildMask(occluders: Occluder[], width: number, height: number, pad = 1): Uint8ClampedArray {
  const mask = new Uint8ClampedArray(width * height).fill(255);
  for (const { spans, mode, tuck } of occluders) {
    if (spans.top < 0) continue;
    // Rows the clip applies to: down to the bottom of the garment's BODY, never
    // the sleeve cuffs below it. On those last rows only a sleeve or two exist
    // (often one cuff hangs lower than the other), so their "outline" is a
    // narrow sliver that would wrongly hide the body of whatever is under it
    // (it showed as a stray line of the persona's waistband above the pants).
    // 'full' additionally follows the garment's own bottom edge column by column
    // (see columnLimits): under a slanted hem nothing of the lower garment shows
    // below the hem, and between hanging cuffs nothing shows either.
    const first = spans.top;
    const last = spans.bodyBottom;
    const limits = columnLimits(spans);
    // The garment's overall width. A row's outline can be narrower than that
    // near a curved hem; pixels there are BELOW the garment's edge (not beside
    // it), so 'rows' leaves them alone.
    let wholeLeft = width;
    let wholeRight = -1;
    for (let y = first; y <= last; y++) {
      if (spans.min[y] >= 0) {
        wholeLeft = Math.min(wholeLeft, spans.min[y]);
        wholeRight = Math.max(wholeRight, spans.max[y]);
      }
    }

    for (let y = 0; y < height; y++) {
      const row = y * width;
      if (mode === 'full') {
        // Where the tuck allows the lower garment back (below the hem only).
        const tuckFrom = tuck && y > first && tuck.min[y] >= 0 ? Math.max(0, tuck.min[y] - pad) : width;
        const tuckTo = tuck && y > first && tuck.min[y] >= 0 ? Math.min(width - 1, tuck.max[y] + pad) : -1;
        const inRows = y >= first && y <= last;
        const hasSpan = inRows && spans.min[y] >= 0;
        const from = hasSpan ? Math.max(0, spans.min[y] - pad) : 0;
        const to = hasSpan ? Math.min(width - 1, spans.max[y] + pad) : width - 1;
        for (let x = 0; x < width; x++) {
          const insideJacket = inRows && x >= from && x <= to && y <= limits[x];
          const tucked = x >= tuckFrom && x <= tuckTo && (!inRows || y > limits[x]);
          if (!insideJacket && !tucked) mask[row + x] = 0;
        }
        continue;
      }
      if (y < first || y > last) continue; // 'rows' leaves everything outside its rows
      // A row inside the range that has nothing in it (a gap between two
      // pieces): leave it alone rather than cutting a stripe.
      if (spans.min[y] < 0) continue;
      const from = Math.max(0, spans.min[y] - pad);
      const to = Math.min(width - 1, spans.max[y] + pad);
      for (let x = 0; x < width; x++) {
        if (x >= from && x <= to) continue;
        const belowEdge = x >= wholeLeft - pad && x <= wholeRight + pad && y > limits[x];
        if (!belowEdge) mask[row + x] = 0;
      }
    }
  }
  return mask;
}
