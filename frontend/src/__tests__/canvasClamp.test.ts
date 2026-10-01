import { describe, expect, it } from 'vitest';
import { STAGE_OVERSHOOT, clampAxisDelta, clampDeltaToStage } from '../components/editor/CanvasUtils';

// Task 83: a garment dragged to the edge of Fabric Studio used to end up
// with its selection handles outside the canvas element (unreachable). The
// clamp keeps the bounding box within the stage plus a small overshoot.
describe('clampAxisDelta', () => {
  it('leaves a span that already fits alone', () => {
    expect(clampAxisDelta(10, 50, 0, 100)).toBe(0);
  });

  it('pushes a span back in from either side', () => {
    expect(clampAxisDelta(-20, 50, 0, 100)).toBe(20);
    expect(clampAxisDelta(70, 50, 0, 100)).toBe(-20);
  });

  it('a span bigger than the room covers the whole range instead of jittering', () => {
    // 150 wide in a 100 range: fine anywhere it still spans [0, 100].
    expect(clampAxisDelta(-30, 150, 0, 100)).toBe(0);
    expect(clampAxisDelta(-10, 150, 0, 100)).toBe(0);
    // Slid too far left (ends before 100) or too far right (starts after 0).
    expect(clampAxisDelta(-80, 150, 0, 100)).toBe(30);
    expect(clampAxisDelta(20, 150, 0, 100)).toBe(-20);
  });
});

describe('clampDeltaToStage', () => {
  const stage = { width: 300, height: 400 };

  it('allows the garment a small overhang past the stage edge', () => {
    const rect = { left: -STAGE_OVERSHOOT, top: 100, width: 100, height: 100 };
    expect(clampDeltaToStage(rect, stage)).toEqual({ dx: 0, dy: 0 });
  });

  it('pulls a garment dragged off the top-left back to the allowed overhang', () => {
    const rect = { left: -200, top: -150, width: 100, height: 100 };
    expect(clampDeltaToStage(rect, stage)).toEqual({ dx: 200 - STAGE_OVERSHOOT, dy: 150 - STAGE_OVERSHOOT });
  });

  it('pulls a garment dragged off the bottom-right back', () => {
    const rect = { left: 350, top: 450, width: 100, height: 100 };
    expect(clampDeltaToStage(rect, stage)).toEqual({
      dx: 300 + STAGE_OVERSHOOT - 450,
      dy: 400 + STAGE_OVERSHOOT - 550,
    });
  });
});
