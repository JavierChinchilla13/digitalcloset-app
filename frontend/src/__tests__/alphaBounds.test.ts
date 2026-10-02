import { describe, expect, it } from 'vitest';
import { alphaBounds, padBox, retargetForTrim } from '../utils/alphaBounds';

// Builds RGBA data for a w x h image with the given opaque rectangle.
function image(w: number, h: number, rect?: { x: number; y: number; w: number; h: number }, alpha = 255) {
  const data = new Uint8ClampedArray(w * h * 4);
  if (rect) {
    for (let y = rect.y; y < rect.y + rect.h; y++) {
      for (let x = rect.x; x < rect.x + rect.w; x++) data[(y * w + x) * 4 + 3] = alpha;
    }
  }
  return data;
}

// Task 84 follow-up: the add-garment cleanup used to export its whole (wide)
// canvas, so the studio's selection box and the warp points sat on the image's
// edges - far from the garment. The export is now trimmed to what is visible.
describe('alphaBounds', () => {
  it('finds the box around the visible pixels', () => {
    const data = image(100, 60, { x: 30, y: 10, w: 20, h: 40 });
    expect(alphaBounds(data, 100, 60)).toEqual({ x: 30, y: 10, width: 20, height: 40 });
  });

  it('is null for a fully transparent image', () => {
    expect(alphaBounds(image(10, 10), 10, 10)).toBeNull();
  });

  it('ignores near-invisible stray pixels', () => {
    const data = image(50, 50, { x: 20, y: 20, w: 5, h: 5 });
    data[(2 * 50 + 3) * 4 + 3] = 8; // a faint speck in the corner
    expect(alphaBounds(data, 50, 50)).toEqual({ x: 20, y: 20, width: 5, height: 5 });
  });

  it('a garment filling the image gives the whole image', () => {
    expect(alphaBounds(image(8, 6, { x: 0, y: 0, w: 8, h: 6 }), 8, 6)).toEqual({ x: 0, y: 0, width: 8, height: 6 });
  });
});

describe('padBox', () => {
  it('adds a small margin on every side', () => {
    const box = { x: 100, y: 100, width: 200, height: 400 };
    // 2% of the longest side (400) = 8px.
    expect(padBox(box, 1000, 1000)).toEqual({ x: 92, y: 92, width: 216, height: 416 });
  });

  it('never leaves the image', () => {
    const box = { x: 0, y: 2, width: 50, height: 50 };
    const padded = padBox(box, 52, 60, 0.1);
    expect(padded.x).toBe(0);
    expect(padded.y).toBe(0);
    expect(padded.x + padded.width).toBeLessThanOrEqual(52);
    expect(padded.y + padded.height).toBeLessThanOrEqual(60);
  });
});

// Cropping a garment's picture must not move the garment: its saved fit
// (size + center) describes the whole picture, so it is retargeted.
describe('retargetForTrim', () => {
  const base = { x: 375, y: 500, width: 400, height: 400, rotation: 0, flipX: false, flipY: false, scaleX: 1, scaleY: 1 };
  // 800 x 400 px picture shown 400 x 400 virtual (0.5 / 1 virtual units per px);
  // cropped to x 200..400, y 50..350 (center 300, 200).
  const trim = { x: 200, y: 50, width: 200, height: 300, fullWidth: 800, fullHeight: 400 };

  it('shrinks the size by the crop ratio and moves the center to the crop center', () => {
    const t = retargetForTrim(base as never, trim);
    expect(t.width).toBeCloseTo(100);
    expect(t.height).toBeCloseTo(300);
    expect(t.x).toBeCloseTo(325); // 100 px left of center = -50 virtual
    expect(t.y).toBeCloseTo(500);
  });

  it('a flipped garment shifts the other way', () => {
    const t = retargetForTrim({ ...base, flipX: true } as never, trim);
    expect(t.x).toBeCloseTo(425);
  });

  it('a rotated garment shifts along its own turned axes', () => {
    // 90 degrees: a move "left" in the picture is "up" on the stage.
    const t = retargetForTrim({ ...base, rotation: 90 } as never, trim);
    expect(t.x).toBeCloseTo(375);
    expect(t.y).toBeCloseTo(450);
  });

  it('a crop of the whole picture changes nothing', () => {
    const t = retargetForTrim(base as never, { x: 0, y: 0, width: 800, height: 400, fullWidth: 800, fullHeight: 400 });
    expect([t.x, t.y, t.width, t.height]).toEqual([375, 500, 400, 400]);
  });
});
