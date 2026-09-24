import { useEffect, useRef, useState } from 'react';
import type { Canvas } from 'fabric';

export interface CanvasSize {
  width: number;
  height: number;
}

interface UseFabricCanvasOptions {
  // When provided, the hook fits containerRef to this aspect ratio
  // (letterboxed, matching each editor's existing resize math) and keeps
  // canvasSize in sync via a window resize listener + ResizeObserver. Omit
  // this for editors that size their canvas once and never resize it again
  // (see measureContainerWithRetry below).
  aspectRatio?: number;
  // Called with the newly fitted size and whatever fabric canvas currently
  // exists (may be null before the canvas is created). Callers decide what
  // to do with a resize - e.g. resize the live canvas in place via
  // setDimensions(), or do nothing if the canvas is meant to be recreated
  // elsewhere in response to canvasSize changing.
  onResize?: (size: CanvasSize, canvas: Canvas | null) => void;
  // Minimum pixel delta (width or height) before a resize is applied.
  // Defaults to 0 (always apply), matching most editors; pass a larger
  // value to reproduce an editor's existing anti-jitter guard exactly.
  resizeThreshold?: number;
}

// Shared Fabric.js canvas lifecycle plumbing (Task 18): the refs every
// editor needs, plus the ResizeObserver-driven "fit to container" logic
// that was previously duplicated verbatim across ClothingCanvas/ShoeCanvas
// and near-identically in JacketCanvas. Canvas creation/disposal and all
// editor-specific event handling stay in each component - they differ too
// much (constructor options, whether the canvas is resized in place or
// recreated) to unify without changing behavior.
export function useFabricCanvas(options: UseFabricCanvasOptions = {}) {
  const { aspectRatio, onResize, resizeThreshold = 0 } = options;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<Canvas | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState<CanvasSize>({ width: 0, height: 0 });

  // Keep the latest onResize without making the effect below re-attach its
  // listeners whenever the caller passes a new inline function.
  const onResizeRef = useRef(onResize);
  onResizeRef.current = onResize;

  // Task 52/53 bug fix: the very first `updateSize()` call below always
  // used to fire before any caller's "create the Fabric Canvas" effect
  // (every editor calls this hook first in its component body, so this
  // effect - registered first - runs first too) - so `onResize` ran with
  // `fabricCanvasRef.current` still null, `canvas?.setDimensions(size)`
  // was a silent no-op, and the Canvas kept the browser's built-in
  // 300x150 default forever unless the container happened to resize
  // again later (which a real user's browser essentially never does on
  // its own) - reproduced live as a completely blank editor canvas on
  // every normal open. `latestSizeRef` keeps the last computed size
  // around even before a Canvas exists, so `setFabricCanvas` (below) can
  // immediately re-apply it the instant the Canvas actually is created,
  // instead of only ever updating on a container resize that may never
  // come.
  const latestSizeRef = useRef<CanvasSize>({ width: 0, height: 0 });

  useEffect(() => {
    if (aspectRatio === undefined) return;

    const updateSize = () => {
      if (!containerRef.current) return;
      const { offsetWidth, offsetHeight } = containerRef.current;
      let width = offsetWidth;
      let height = offsetWidth / aspectRatio;

      if (height > offsetHeight) {
        height = offsetHeight;
        width = height * aspectRatio;
      }

      latestSizeRef.current = { width, height };

      setCanvasSize((prev) => {
        if (
          Math.abs(prev.width - width) <= resizeThreshold &&
          Math.abs(prev.height - height) <= resizeThreshold
        ) {
          return prev;
        }
        return { width, height };
      });

      onResizeRef.current?.({ width, height }, fabricCanvasRef.current);
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    const observer = new ResizeObserver(updateSize);
    if (containerRef.current) observer.observe(containerRef.current);

    return () => {
      window.removeEventListener('resize', updateSize);
      observer.disconnect();
    };
  }, [aspectRatio, resizeThreshold]);

  // Callers should use this instead of assigning `fabricCanvasRef.current`
  // directly (every editor used to) - see the comment on `latestSizeRef`
  // above for why a plain assignment misses the canvas's correct initial
  // size.
  const setFabricCanvas = (canvas: Canvas | null) => {
    fabricCanvasRef.current = canvas;
    if (canvas && latestSizeRef.current.width > 0) {
      onResizeRef.current?.(latestSizeRef.current, canvas);
    }
  };

  return { canvasRef, fabricCanvasRef, containerRef, canvasSize, setFabricCanvas };
}

// Measures a container element's size, retrying while layout hasn't settled
// yet (offsetWidth still 0) - GarmentCleanup's exact original polling loop,
// used by editors that size their canvas once at creation and never resize
// it afterward, so they don't use the ResizeObserver path above.
export async function measureContainerWithRetry(
  el: HTMLElement | null,
  { retries = 20, delayMs = 50 }: { retries?: number; delayMs?: number } = {}
): Promise<CanvasSize> {
  let width = 0;
  let height = 0;

  for (let i = 0; i < retries; i++) {
    width = el?.offsetWidth || 0;
    height = el?.offsetHeight || 0;
    if (width > 0) break;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  return { width, height };
}
