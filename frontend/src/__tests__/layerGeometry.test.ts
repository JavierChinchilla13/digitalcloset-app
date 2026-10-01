import { describe, expect, it } from 'vitest';
import { ClothingCategory as C, PersonaType } from '../types';
import { cropInsets, jacketOpening, resolveFinalTransform } from '../utils/layerGeometry';
import type { ClothingTransform } from '../types';

// Task 85: PersonaLayer (CSS) and the occlusion masks (offscreen canvas) share
// this placement logic so a garment's mask always lines up with the garment.
const t = (over: Partial<ClothingTransform> = {}): ClothingTransform => ({
  x: 375,
  y: 500,
  scaleX: 1,
  scaleY: 1,
  rotation: 0,
  width: 400,
  height: 400,
  ...over,
});

describe('resolveFinalTransform', () => {
  it("uses the garment's own transform when it has a size", () => {
    const own = t();
    expect(resolveFinalTransform(own, C.TOP, PersonaType.MALE)).toBe(own);
  });

  it('falls back to the category preset, and to the pair preset for a side shoe', () => {
    expect(resolveFinalTransform(undefined, C.TOP, PersonaType.MALE)).toBeTruthy();
    const left = resolveFinalTransform(undefined, C.SHOES, PersonaType.MALE, 'left');
    const right = resolveFinalTransform(undefined, C.SHOES, PersonaType.MALE, 'right');
    expect(left).toBeTruthy();
    expect(left).not.toEqual(right);
  });

  it('is null with neither a transform nor a category', () => {
    expect(resolveFinalTransform(undefined, undefined, PersonaType.MALE)).toBeNull();
  });
});

describe('cropInsets', () => {
  it('is null when there is no crop', () => {
    expect(cropInsets(t())).toBeNull();
  });

  it("reads the crop's center position as edges (the right half of a 400 box)", () => {
    // Garment box x 175..575; crop = right half: center x 475, width 200.
    const insets = cropInsets(t({ maskLeft: 475, maskTop: 500, maskWidth: 200, maskHeight: 400 }))!;
    expect(insets.left).toBeCloseTo(50);
    expect(insets.right).toBeCloseTo(0);
    expect(insets.top).toBeCloseTo(0);
    expect(insets.bottom).toBeCloseTo(0);
  });

  it('never goes negative when the crop overshoots the garment', () => {
    const insets = cropInsets(t({ maskLeft: 375, maskTop: 500, maskWidth: 600, maskHeight: 600 }))!;
    expect(Math.min(insets.top, insets.right, insets.bottom, insets.left)).toBe(0);
  });
});

describe('jacketOpening', () => {
  it('is the centered hole as percents of the width', () => {
    expect(jacketOpening(t({ openness: 0.2 }), C.JACKET)).toEqual({ start: 40, end: 60 });
  });

  it('only exists for an open jacket', () => {
    expect(jacketOpening(t({ openness: 0 }), C.JACKET)).toBeNull();
    expect(jacketOpening(t({ openness: 0.5 }), C.TOP)).toBeNull();
  });
});
