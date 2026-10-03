import { describe, expect, it } from 'vitest';
import { swipeDirection, SWIPE_DISTANCE_PX, SWIPE_VELOCITY_PX_PER_S } from '../utils/swipe';

// Task 92: what a horizontal drag on the Showcase means.
describe('swipeDirection', () => {
  it('a long drag left goes to the next outfit, a long drag right to the previous one', () => {
    expect(swipeDirection(-SWIPE_DISTANCE_PX, 0)).toBe('next');
    expect(swipeDirection(-200, 0)).toBe('next');
    expect(swipeDirection(SWIPE_DISTANCE_PX, 0)).toBe('prev');
    expect(swipeDirection(200, 0)).toBe('prev');
  });

  it('a quick flick counts even over a short distance', () => {
    expect(swipeDirection(-20, -SWIPE_VELOCITY_PX_PER_S)).toBe('next');
    expect(swipeDirection(20, SWIPE_VELOCITY_PX_PER_S)).toBe('prev');
  });

  it('a small, slow wobble (or a tap) does nothing', () => {
    expect(swipeDirection(0, 0)).toBeNull();
    expect(swipeDirection(-(SWIPE_DISTANCE_PX - 1), -(SWIPE_VELOCITY_PX_PER_S - 1))).toBeNull();
    expect(swipeDirection(SWIPE_DISTANCE_PX - 1, SWIPE_VELOCITY_PX_PER_S - 1)).toBeNull();
  });
});
