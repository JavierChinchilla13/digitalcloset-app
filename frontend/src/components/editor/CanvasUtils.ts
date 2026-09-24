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
 * canvas can only draw inside its own element, so selection handles (corner
 * handles sit ~16px outside the object, the rotate handle ~50px above it)
 * used to be cut off whenever the garment was moved to the top/bottom edge
 * of the stage. The canvas is now this much bigger on every side with its
 * viewport shifted by this amount, so object coordinates are still
 * stage-based (0..stage width/height) and the handles have room to draw.
 */
export const CANVAS_PAD = 36;

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
 * Centers an object on the stage (getCenterPoint/centerObject would center on
 * the padded canvas instead).
 */
export const centerOnStage = (canvas: Canvas, obj: FabricObject) => {
  obj.set({ left: stageWidth(canvas) / 2, top: stageHeight(canvas) / 2 });
  obj.setCoords();
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
