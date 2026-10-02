import { Image as FabricImage, Object as FabricObject, Canvas, Rect } from 'fabric';

/**
 * Constants for the virtual coordinate system.
 * Baseline height is 1000px, aspect ratio 3:4, width 750px.
 */
export const VIRTUAL_HEIGHT = 1000;
export const ASPECT_RATIO = 3 / 4;
export const VIRTUAL_WIDTH = VIRTUAL_HEIGHT * ASPECT_RATIO;

/**
 * Margin (px, each side) ClothingCanvas adds around its 3:4 stage. A Fabric
 * canvas can only draw inside its own element, so selection handles used to
 * be cut off whenever the garment was moved to an edge of the stage. The
 * canvas is this much bigger on every side with its viewport shifted by this
 * amount, so object coordinates are still stage-based (0..stage width/height)
 * and the handles have room to draw.
 *
 * Task 83: 36 -> 56. Handles reach ~30px past the top of a selected object
 * (see HANDLE_REACH) and the garment could be dragged anywhere, so 36 was not
 * enough; together with clampToStage this keeps every handle reachable.
 */
export const CANVAS_PAD = 56;

/**
 * How far selection handles reach beyond the object's own bounding box, worst
 * case (the rotate handle: 6px object padding + 16px offset + 6px radius + the
 * border). Must stay in sync with FabricControls.
 */
export const HANDLE_REACH = 30;

/**
 * How far past the stage edge an object's bounding box may sit while its
 * handles still fit inside the padded canvas. Garment presets deliberately
 * overhang the stage a little (a dress or trousers run past the mannequin's
 * feet), so the limit is not zero.
 */
export const STAGE_OVERSHOOT = CANVAS_PAD - HANDLE_REACH;

// The stage (the 3:4 area all virtual coordinates are relative to) is the
// canvas minus its CANVAS_PAD margin on every side.
export const stageWidth = (canvas: Canvas) => canvas.getWidth() - 2 * CANVAS_PAD;
export const stageHeight = (canvas: Canvas) => canvas.getHeight() - 2 * CANVAS_PAD;

/**
 * Sizes a canvas to `stage` plus the handle margin and shifts its viewport so
 * scene coordinates stay stage-based (0,0 is the stage's top-left corner).
 * Use as the canvas's resize handler.
 */
export const applyStagePadding = (canvas: Canvas, stage: { width: number; height: number }) => {
  canvas.setDimensions({
    width: stage.width + 2 * CANVAS_PAD,
    height: stage.height + 2 * CANVAS_PAD,
  });
  canvas.setViewportTransform([1, 0, 0, 1, CANVAS_PAD, CANVAS_PAD]);
};

/**
 * applyStagePadding for a canvas that already shows objects: after resizing,
 * everything on it is scaled by the same factor as the stage (the stage keeps
 * its 3:4 shape, so one factor covers both axes) rather than being cleared
 * and reloaded. Objects sit in stage coordinates, so the scaling is around the
 * stage center.
 */
export const resizeStageKeepingObjects = (canvas: Canvas, stage: { width: number; height: number }) => {
  const prev = { width: stageWidth(canvas), height: stageHeight(canvas) };
  const hadObjects = canvas.getObjects().length > 0;
  applyStagePadding(canvas, stage);
  if (hadObjects && prev.height > 0) {
    rescaleObjects(
      canvas,
      stage.height / prev.height,
      { x: prev.width / 2, y: prev.height / 2 },
      { x: stage.width / 2, y: stage.height / 2 }
    );
  }
};

/**
 * Centers an object on the stage (getCenterPoint/centerObject would center on
 * the padded canvas instead).
 */
export const centerOnStage = (canvas: Canvas, obj: FabricObject) => {
  obj.set({ left: stageWidth(canvas) / 2, top: stageHeight(canvas) / 2 });
  obj.setCoords();
};

/**
 * Offset that moves the span [start, start + size] inside [min, max]. A span
 * larger than the room can't fit, so it must cover the whole range instead
 * (its two ends stay outside), which keeps dragging smooth rather than
 * jittering between the two edges.
 */
export const clampAxisDelta = (start: number, size: number, min: number, max: number): number => {
  const end = start + size;
  if (size >= max - min) {
    if (start > min) return min - start;
    if (end < max) return max - end;
    return 0;
  }
  if (start < min) return min - start;
  if (end > max) return max - end;
  return 0;
};

/**
 * How far to shift a bounding box (stage coordinates) so it stays within the
 * stage plus STAGE_OVERSHOOT on every side - i.e. so its handles stay inside
 * the padded canvas. Pure so it can be unit tested without Fabric.
 */
export const clampDeltaToStage = (
  rect: { left: number; top: number; width: number; height: number },
  stage: { width: number; height: number },
  overshoot: number = STAGE_OVERSHOOT
): { dx: number; dy: number } => ({
  dx: clampAxisDelta(rect.left, rect.width, -overshoot, stage.width + overshoot),
  dy: clampAxisDelta(rect.top, rect.height, -overshoot, stage.height + overshoot),
});

/**
 * Nudges an object back so its handles stay reachable (see clampDeltaToStage).
 * Use from the canvas's 'object:moving' / 'object:modified' handlers.
 */
export const keepHandlesReachable = (canvas: Canvas, obj: FabricObject) => {
  const rect = obj.getBoundingRect();
  const { dx, dy } = clampDeltaToStage(rect, { width: stageWidth(canvas), height: stageHeight(canvas) });
  if (dx === 0 && dy === 0) return;
  obj.set({ left: (obj.left ?? 0) + dx, top: (obj.top ?? 0) + dy });
  obj.setCoords();
};

/**
 * Scales every object on the canvas by `ratio` around a point, so a canvas
 * that was just resized keeps showing the same picture (instead of clearing
 * and reloading every image). `from` is the old center, `to` the new one, in
 * scene coordinates. Crop-mask clip paths are scaled with their objects.
 */
export const rescaleObjects = (
  canvas: Canvas,
  ratio: number,
  from: { x: number; y: number },
  to: { x: number; y: number }
) => {
  if (!Number.isFinite(ratio) || ratio <= 0 || Math.abs(ratio - 1) < 1e-6) return;
  const move = (v: number | undefined, f: number, t: number) => t + ((v ?? 0) - f) * ratio;

  canvas.getObjects().forEach((obj) => {
    obj.set({
      left: move(obj.left, from.x, to.x),
      top: move(obj.top, from.y, to.y),
      scaleX: (obj.scaleX ?? 1) * ratio,
      scaleY: (obj.scaleY ?? 1) * ratio,
    });
    const clip = obj.clipPath;
    if (clip) {
      clip.set({
        left: move(clip.left, from.x, to.x),
        top: move(clip.top, from.y, to.y),
        scaleX: (clip.scaleX ?? 1) * ratio,
        scaleY: (clip.scaleY ?? 1) * ratio,
        // Crop-mask rects bake their size into width/height (scale stays 1)
        // - see ClothingCanvas - so those scale too; for any other clip the
        // scale above already covers it, and width/height stay untouched.
        ...(clip.name === 'cropMask' && {
          width: (clip.width ?? 0) * ratio,
          height: (clip.height ?? 0) * ratio,
          scaleX: 1,
          scaleY: 1,
        }),
      });
    }
    obj.setCoords();
  });
};

/**
 * Converts virtual X (0-750) to actual canvas pixels, anchored to the center.
 */
export const toCanvasX = (virtualX: number, canvasWidth: number, canvasHeight: number) => {
  const centerCanvasX = canvasWidth / 2;
  const virtualXOffset = virtualX - VIRTUAL_WIDTH / 2;
  return centerCanvasX + (virtualXOffset * canvasHeight) / VIRTUAL_HEIGHT;
};

/**
 * Converts actual canvas X pixels to virtual X (0-750), anchored to the center.
 */
export const toVirtualX = (canvasX: number, canvasWidth: number, canvasHeight: number) => {
  const centerCanvasX = canvasWidth / 2;
  const canvasXOffset = canvasX - centerCanvasX;
  return VIRTUAL_WIDTH / 2 + (canvasXOffset * VIRTUAL_HEIGHT) / canvasHeight;
};

/**
 * Converts virtual units (0-1000) to actual canvas pixels.
 */
export const toCanvasCoord = (virtualValue: number, canvasHeight: number) => {
  return (virtualValue * canvasHeight) / VIRTUAL_HEIGHT;
};

/**
 * Converts actual canvas pixels to virtual units (0-1000).
 */
export const toVirtualCoord = (canvasValue: number, canvasHeight: number) => {
  return (canvasValue * VIRTUAL_HEIGHT) / canvasHeight;
};

/**
 * Loads an image into a FabricImage object.
 */
export const loadFabricImage = (url: string): Promise<FabricImage> => {
  return FabricImage.fromURL(url, { crossOrigin: 'anonymous' });
};

/**
 * Gets the current transform data from a Fabric object in absolute virtual units.
 */
export const getVirtualTransform = (obj: FabricObject, canvasWidth: number, canvasHeight: number) => {
  const scaledWidth = obj.getScaledWidth();
  const scaledHeight = obj.getScaledHeight();

  // Rounding to 2 decimal places prevents precision jitter
  const transform = {
    x: Number(toVirtualX(obj.left || 0, canvasWidth, canvasHeight).toFixed(2)),
    y: Number(toVirtualCoord(obj.top || 0, canvasHeight).toFixed(2)),
    width: Number(toVirtualCoord(scaledWidth, canvasHeight).toFixed(2)),
    height: Number(toVirtualCoord(scaledHeight, canvasHeight).toFixed(2)),
    rotation: Number((obj.angle || 0).toFixed(2)),
    opacity: obj.opacity || 1,
    flipX: obj.flipX || false,
    flipY: obj.flipY || false,
    scaleX: 1, // Normalized
    scaleY: 1,
    maskLeft: 0,
    maskTop: 0,
    maskWidth: 0,
    maskHeight: 0
  };

  // Extract absolute mask coordinates if present
  if (obj.clipPath && obj.clipPath.name === 'cropMask') {
    const cp = obj.clipPath as Rect;
    transform.maskLeft = toVirtualX(cp.left!, canvasWidth, canvasHeight);
    transform.maskTop = toVirtualCoord(cp.top!, canvasHeight);
    transform.maskWidth = toVirtualCoord(cp.width!, canvasHeight);
    transform.maskHeight = toVirtualCoord(cp.height!, canvasHeight);
  }

  return transform;
};

/**
 * Centers an object on the canvas.
 */
export const centerObject = (canvas: Canvas, obj: FabricObject) => {
  const center = canvas.getCenterPoint();
  obj.set({
    left: center.x,
    top: center.y
  });
  obj.setCoords();
};

/**
 * Exports the canvas as a high-resolution PNG.
 */
export const exportCanvasToImage = (
  canvas: Canvas,
  // Optional crop, in canvas (viewport) pixels - used to drop ClothingCanvas's
  // handle margin from the exported image.
  region?: { left: number; top: number; width: number; height: number }
): string => {
  return canvas.toDataURL({
    format: 'png',
    multiplier: 2,
    ...region,
  });
};
