import { describe, expect, it } from 'vitest';
import { applyAffine } from '../utils/meshWarp';
import { garmentToStageMatrix, clampStagePoint } from '../components/editor/WarpPanel';
import { CANVAS_PAD } from '../components/editor/CanvasUtils';

// Task 84: the warp points are drawn over the studio canvas, so the math that
// places the source image on the stage must agree with where the Fabric
// garment sits, and a dragged point must stay inside the overlay canvas.
describe('garmentToStageMatrix', () => {
  // A 3:4 stage 300 x 400 px (a virtual 750 x 1000 space, so 0.4 px per unit).
  const stageW = 300;
  const stageH = 400;
  const source = { w: 200, h: 100 };
  const base = { x: 375, y: 500, width: 500, height: 250, rotation: 0, flipX: false, flipY: false };

  it("puts the image's center on the garment's (x, y)", () => {
    const m = garmentToStageMatrix(source, null, base, stageW, stageH);
    const c = applyAffine(m, { x: source.w / 2, y: source.h / 2 });
    expect(c.x).toBeCloseTo(150); // virtual x 375 = the stage's horizontal center
    expect(c.y).toBeCloseTo(200); // virtual y 500 = halfway down
  });

  it("scales the image to the garment's virtual width and height", () => {
    const m = garmentToStageMatrix(source, null, base, stageW, stageH);
    const left = applyAffine(m, { x: 0, y: source.h / 2 });
    const right = applyAffine(m, { x: source.w, y: source.h / 2 });
    expect(right.x - left.x).toBeCloseTo(500 * 0.4); // 500 virtual units
  });

  it('flips and rotates like the garment', () => {
    const flipped = garmentToStageMatrix(source, null, { ...base, flipX: true }, stageW, stageH);
    const l = applyAffine(flipped, { x: 0, y: 50 });
    const r = applyAffine(flipped, { x: 200, y: 50 });
    expect(l.x).toBeGreaterThan(r.x);

    const turned = garmentToStageMatrix(source, null, { ...base, rotation: 90 }, stageW, stageH);
    const a = applyAffine(turned, { x: 0, y: 50 });
    const b = applyAffine(turned, { x: 200, y: 50 });
    // A quarter turn: the image's horizontal edge now runs vertically.
    expect(Math.abs(b.x - a.x)).toBeLessThan(1e-6);
    expect(Math.abs(b.y - a.y)).toBeCloseTo(500 * 0.4);
  });

  it("anchors a warped garment's baked image at the original's center plus the shift", () => {
    const warp = { bakedWidth: 300, bakedHeight: 100, shift: { x: 20, y: 0 } };
    const m = garmentToStageMatrix(source, warp, base, stageW, stageH);
    // The baked image's center (original center + shift) is what sits at (x, y).
    const c = applyAffine(m, { x: source.w / 2 + 20, y: source.h / 2 });
    expect(c.x).toBeCloseTo(150);
    expect(c.y).toBeCloseTo(200);
  });
});

describe('clampStagePoint', () => {
  it('leaves a point on the stage alone', () => {
    expect(clampStagePoint({ x: 10, y: 390 }, 300, 400)).toEqual({ x: 10, y: 390 });
  });

  it('stops a point where its handle still fits inside the canvas margin', () => {
    const p = clampStagePoint({ x: -999, y: 999 }, 300, 400);
    expect(p.x).toBeLessThan(0);
    expect(p.x).toBeGreaterThan(-CANVAS_PAD); // a 9px handle fits in what's left
    expect(p.y).toBeGreaterThan(400);
    expect(p.y).toBeLessThan(400 + CANVAS_PAD);
  });
});
