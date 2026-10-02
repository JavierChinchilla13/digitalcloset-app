import { describe, expect, it } from 'vitest';
import { ClothingCategory as C } from '../types';
import { buildMask, clipMode, columnLimits, rowSpans, type Occluder } from '../utils/occlusion';

// Task 85: realistic layering. A shirt under a jacket must not stick out past
// the jacket's outline (sides, hem) and shows only through its opening; other
// pairs are clipped only across the rows the upper garment covers.

const W = 20;
const H = 20;

// Alpha for a W x H picture from a list of filled rectangles.
function alpha(rects: Array<[number, number, number, number]>) {
  const a = new Uint8ClampedArray(W * H);
  for (const [x, y, w, h] of rects) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) a[j * W + i] = 255;
  }
  return a;
}

const at = (mask: Uint8ClampedArray, x: number, y: number) => mask[y * W + x];

describe('rowSpans', () => {
  it('measures each row edge to edge and the first / last row', () => {
    const s = rowSpans(alpha([[5, 3, 10, 4]]), W, H);
    expect([s.top, s.bottom]).toEqual([3, 6]);
    expect([s.min[3], s.max[3]]).toEqual([5, 14]);
    expect(s.min[0]).toBe(-1);
  });

  it('keeps an opening INSIDE the span (it is not filled, just not left out)', () => {
    // An open jacket: left half x 2..7 and right half x 12..17 over rows 4..14.
    const s = rowSpans(alpha([[2, 4, 6, 11], [12, 4, 6, 11]]), W, H);
    expect([s.min[8], s.max[8]]).toEqual([2, 17]);
  });

  it('is empty for a transparent picture', () => {
    expect(rowSpans(new Uint8Array(W * H), W, H).top).toBe(-1);
  });
});

describe('bodyBottom', () => {
  it('is the last row when the garment has no sleeves hanging lower', () => {
    expect(rowSpans(alpha([[4, 4, 12, 10]]), W, H).bodyBottom).toBe(13);
  });

  it('ignores sleeves that hang lower than the body', () => {
    // Body x 6..13 down to row 12; sleeves x 1..3 and 16..18 down to row 17.
    const s = rowSpans(alpha([[6, 3, 8, 10], [1, 4, 3, 14], [16, 4, 3, 14]]), W, H);
    expect(s.bottom).toBe(17);
    expect(s.bodyBottom).toBe(12);
  });

  it('is -1 for a transparent picture', () => {
    expect(rowSpans(new Uint8Array(W * H), W, H).bodyBottom).toBe(-1);
  });
});

describe('columnLimits', () => {
  it("follows a slanted hem: each column ends at the garment's own bottom edge", () => {
    // Left panel x 4..9 down to row 8, right panel x 10..15 down to row 12.
    const s = rowSpans(alpha([[4, 4, 6, 5], [10, 4, 6, 9]]), W, H);
    const limits = columnLimits(s);
    expect(limits[5]).toBe(8);
    expect(limits[14]).toBe(12);
  });

  it('a gap in the front follows the edge on either side of it, in a straight line', () => {
    // Panels x 4..7 (to row 6) and x 12..15 (to row 14), gap x 8..11.
    const s = rowSpans(alpha([[4, 3, 4, 4], [12, 3, 4, 12]]), W, H);
    const limits = columnLimits(s);
    expect(limits[7]).toBe(6);
    expect(limits[12]).toBe(14);
    expect(limits[9]).toBeGreaterThan(6);
    expect(limits[9]).toBeLessThan(14);
  });

  it("never goes below the body's bottom (sleeve cuffs hanging lower)", () => {
    const s = rowSpans(alpha([[6, 3, 8, 10], [1, 4, 3, 14], [16, 4, 3, 14]]), W, H);
    const limits = columnLimits(s);
    expect(limits[2]).toBe(s.bodyBottom);
    expect(limits[17]).toBe(s.bodyBottom);
  });
});

describe('clipMode', () => {
  it('a top or dress under a jacket is clipped completely', () => {
    expect(clipMode(C.TOP, C.JACKET)).toBe('full');
    expect(clipMode(C.DRESS, C.JACKET)).toBe('full');
  });

  it('every other pair of garments is clipped across the upper garment rows only', () => {
    expect(clipMode(C.BOTTOM, C.TOP)).toBe('rows'); // pants under a shirt
    expect(clipMode(C.TOP, C.BOTTOM)).toBe('rows'); // shirt under pants
    expect(clipMode(C.SHOES, C.BOTTOM)).toBe('rows'); // shoes under pants
    expect(clipMode(C.BOTTOM, C.JACKET)).toBe('rows');
  });

  it('upper-body pieces under another upper-body piece are not clipped: a jacket under a shirt keeps its sleeves', () => {
    expect(clipMode(C.JACKET, C.TOP)).toBeNull();
    expect(clipMode(C.JACKET, C.DRESS)).toBeNull();
    expect(clipMode(C.TOP, C.TOP)).toBeNull();
    expect(clipMode(C.DRESS, C.TOP)).toBeNull();
    expect(clipMode(C.JACKET, C.JACKET)).toBeNull();
  });

  it('shoes never clip what is under them, and accessories never take part', () => {
    expect(clipMode(C.BOTTOM, C.SHOES)).toBeNull();
    expect(clipMode(C.TOP, C.ACCESSORY)).toBeNull();
    expect(clipMode(C.ACCESSORY, C.JACKET)).toBeNull();
  });
});

describe('buildMask', () => {
  // The jacket: rows 4..13, x 4..15 (a closed jacket for the simple cases).
  const jacket = rowSpans(alpha([[4, 4, 12, 10]]), W, H);
  // A shirt bigger than the jacket: rows 2..17, x 1..18.
  // (Only the mask matters here, so the shirt's own pixels aren't needed.)

  it('full: nothing of the lower garment outside the jacket outline survives', () => {
    const mask = buildMask([{ spans: jacket, mode: 'full' }], W, H, 0);
    // Inside the jacket box: visible.
    expect(at(mask, 4, 4)).toBe(255);
    expect(at(mask, 15, 13)).toBe(255);
    // Beside it (sides): hidden.
    expect(at(mask, 3, 8)).toBe(0);
    expect(at(mask, 16, 8)).toBe(0);
    // Above the collar and below the hem: hidden (the shirt can't hang out).
    expect(at(mask, 8, 3)).toBe(0);
    expect(at(mask, 8, 14)).toBe(0);
    expect(at(mask, 8, 19)).toBe(0);
  });

  it('full: below the jacket body nothing shows, even between sleeve cuffs hanging lower', () => {
    // Body x 6..13 to row 12; sleeves x 1..3 and 16..18 to row 17.
    const flared = rowSpans(alpha([[6, 3, 8, 10], [1, 4, 3, 14], [16, 4, 3, 14]]), W, H);
    const mask = buildMask([{ spans: flared, mode: 'full' }], W, H, 0);
    expect(at(mask, 9, 12)).toBe(255); // still on the body
    expect(at(mask, 9, 14)).toBe(0); // between the cuffs, below the body
    expect(at(mask, 9, 17)).toBe(0);
    // 'rows' (pants etc.) stops at the body bottom too: the sleeve-only rows
    // below it clip nothing.
    const rows = buildMask([{ spans: flared, mode: 'rows' }], W, H, 0);
    expect(at(rows, 9, 14)).toBe(255);
    expect(at(rows, 0, 14)).toBe(255);
    expect(at(rows, 0, 8)).toBe(0); // still clipped beside the body on its own rows
  });

  it('rows: a curved hem does not hide what is below it at the corners', () => {
    // A garment x 4..15, rows 4..9, with its bottom corners cut away
    // (x 4..5 and 14..15 end at row 7): the outline narrows near the hem.
    const curved = rowSpans(alpha([[6, 4, 8, 6], [4, 4, 2, 4], [14, 4, 2, 4]]), W, H);
    const mask = buildMask([{ spans: curved, mode: 'rows' }], W, H, 0);
    expect(at(mask, 4, 9)).toBe(255); // under the cut corner, within the garment's width: below its edge
    expect(at(mask, 15, 8)).toBe(255);
    expect(at(mask, 3, 6)).toBe(0); // beside the garment: still clipped
    expect(at(mask, 16, 6)).toBe(0);
    expect(at(mask, 4, 6)).toBe(255); // on the garment
  });

  it('rows: one sleeve hanging lower than the other must not hide the body under it', () => {
    // Body x 6..13 to row 10; left cuff to row 12; right cuff (x 16..18) to row 16.
    // Rows 13..16 contain only the right sleeve - a narrow sliver.
    const uneven = rowSpans(alpha([[6, 3, 8, 8], [1, 4, 3, 9], [16, 4, 3, 13]]), W, H);
    const mask = buildMask([{ spans: uneven, mode: 'rows' }], W, H, 0);
    expect(at(mask, 9, 14)).toBe(255); // the pants under the body are not cut
  });

  it('full: under a slanted hem nothing shows below the hem on the higher side', () => {
    // Left panel x 4..9 to row 8, right panel x 10..15 to row 12.
    const slanted = rowSpans(alpha([[4, 4, 6, 5], [10, 4, 6, 9]]), W, H);
    const mask = buildMask([{ spans: slanted, mode: 'full' }], W, H, 0);
    expect(at(mask, 6, 8)).toBe(255);
    expect(at(mask, 6, 10)).toBe(0); // below the left hem, though the right side goes lower
    expect(at(mask, 13, 10)).toBe(255);
    expect(at(mask, 13, 13)).toBe(0);
  });

  it('full + tuck: below the hem the shirt shows again, but only inside the trousers outline', () => {
    // Jacket x 4..15, rows 4..9. Trousers x 6..13, rows 3..19 (their top is
    // hidden under the shirt, so they reach above the hem).
    const hem = rowSpans(alpha([[4, 4, 12, 6]]), W, H);
    const trousers = rowSpans(alpha([[6, 3, 8, 17]]), W, H);
    const mask = buildMask([{ spans: hem, mode: 'full', tuck: trousers }], W, H, 0);
    expect(at(mask, 9, 11)).toBe(255); // below the hem, within the trousers: the tucked shirt
    expect(at(mask, 5, 11)).toBe(0); // below the hem but beside the trousers: hidden
    expect(at(mask, 9, 19)).toBe(255); // still within the trousers rows
    expect(at(mask, 9, 3)).toBe(0); // above the jacket: never tucked
    expect(at(mask, 3, 6)).toBe(0); // beside the jacket on its own rows: still hidden
  });

  it('full without trousers: nothing shows below the hem', () => {
    const hem = rowSpans(alpha([[4, 4, 12, 6]]), W, H);
    const mask = buildMask([{ spans: hem, mode: 'full', tuck: null }], W, H, 0);
    expect(at(mask, 9, 11)).toBe(0);
  });

  it('full: the opening of an open jacket stays visible, so the shirt shows through it', () => {
    const open = rowSpans(alpha([[4, 4, 5, 10], [11, 4, 5, 10]]), W, H); // gap at x 9..10
    const mask = buildMask([{ spans: open, mode: 'full' }], W, H, 0);
    expect(at(mask, 9, 8)).toBe(255);
    expect(at(mask, 10, 8)).toBe(255);
    expect(at(mask, 3, 8)).toBe(0);
  });

  it('rows: only the rows the upper garment covers are clipped; below them stays visible', () => {
    const mask = buildMask([{ spans: jacket, mode: 'rows' }], W, H, 0);
    expect(at(mask, 3, 8)).toBe(0); // beside the garment, on its rows
    expect(at(mask, 8, 8)).toBe(255);
    expect(at(mask, 1, 2)).toBe(255); // above its rows
    expect(at(mask, 1, 17)).toBe(255); // below its rows (e.g. a shirt hanging below pants)
  });

  it('several garments above: a pixel must be allowed by all of them', () => {
    const a: Occluder = { spans: jacket, mode: 'rows' };
    const b: Occluder = { spans: rowSpans(alpha([[6, 4, 4, 10]]), W, H), mode: 'rows' };
    const mask = buildMask([a, b], W, H, 0);
    expect(at(mask, 7, 8)).toBe(255);
    expect(at(mask, 12, 8)).toBe(0); // inside the first, outside the second
  });

  it('pad widens each row slightly so the outline edge is not shaved off', () => {
    const mask = buildMask([{ spans: jacket, mode: 'rows' }], W, H, 1);
    expect(at(mask, 3, 8)).toBe(255);
    expect(at(mask, 2, 8)).toBe(0);
  });

  it('an empty garment hides nothing', () => {
    const empty = rowSpans(new Uint8Array(W * H), W, H);
    const mask = buildMask([{ spans: empty, mode: 'full' }], W, H);
    expect(mask.every((v) => v === 255)).toBe(true);
  });
});
