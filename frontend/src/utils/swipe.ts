// Decides what a horizontal drag/swipe on the Showcase means (Task 92). A drag counts
// when it travelled far enough, or was flicked fast enough even over a short distance;
// anything smaller is treated as a tap or an accidental wobble. Dragging LEFT moves to
// the next outfit (like turning a page), dragging RIGHT to the previous one.
export const SWIPE_DISTANCE_PX = 60;
export const SWIPE_VELOCITY_PX_PER_S = 450;

export type SwipeDirection = 'next' | 'prev' | null;

export function swipeDirection(offsetX: number, velocityX: number): SwipeDirection {
  if (offsetX <= -SWIPE_DISTANCE_PX || velocityX <= -SWIPE_VELOCITY_PX_PER_S) return 'next';
  if (offsetX >= SWIPE_DISTANCE_PX || velocityX >= SWIPE_VELOCITY_PX_PER_S) return 'prev';
  return null;
}
