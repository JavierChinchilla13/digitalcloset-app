import React, { useEffect, useRef } from 'react';
import { Canvas, Rect, Image as FabricImage } from 'fabric';
import { PersonaType, ClothingCategory, type ClothingTransform } from '../../types';
import {
  ASPECT_RATIO,
  toCanvasCoord,
  toVirtualCoord,
  toCanvasX,
  loadFabricImage,
  centerObject,
  getVirtualTransform
} from './CanvasUtils';
import { customizeFabricControls, lockObject } from './FabricControls';
import { useFabricCanvas } from '../../hooks/useFabricCanvas';
import { getStageAccentHex, getStageAccentRgba } from '../../utils/themeColors';

interface ClothingCanvasProps {
  imageUrl: string;
  category: ClothingCategory;
  personaType: PersonaType;
  transform: ClothingTransform;
  onTransformChange: (transform: ClothingTransform) => void;
  onCanvasReady?: (canvas: Canvas) => void;
  activeTool?: string;
}

const ClothingCanvas: React.FC<ClothingCanvasProps> = ({ 
  imageUrl, 
  personaType, 
  transform, 
  onTransformChange,
  onCanvasReady,
  activeTool = 'select'
}) => {
  const { canvasRef, fabricCanvasRef, containerRef, canvasSize, setFabricCanvas } = useFabricCanvas({
    aspectRatio: ASPECT_RATIO,
    onResize: (size, canvas) => {
      canvas?.setDimensions(size);
      canvas?.requestRenderAll();
    },
  });
  const isUpdatingRef = useRef(false);

  // Task 53 (stale closure fix): `handleModified` below is registered once
  // in an effect with `[]` deps, and `updateCrop` (in the crop effect) is
  // re-created only when `activeTool` changes - neither re-runs when
  // `transform` itself changes, so a plain `transform` reference inside
  // either closure stays frozen at whatever it was when that effect last
  // ran. Both spread `{...transform, ...}` to build the next update, so a
  // stale `transform` there silently reverts any other in-flight change
  // (confirmed live: entering crop mode then dragging the crop box once
  // reverted an unrelated sidebar edit). `transformRef` is written on
  // every render (a plain assignment, not an effect - cheap, and always
  // up to date before any event handler can fire), so reading
  // `transformRef.current` instead always gets the latest value
  // regardless of which render created the closure that's reading it.
  const transformRef = useRef(transform);
  transformRef.current = transform;

  // Task 53 (mask-follows-garment fix): tracks the garment's own
  // left/top from whichever code path last positioned it - a direct
  // canvas drag (`handleModified` below) or a programmatic sync from
  // props (the "Sync Transform updates from props" effect further down)
  // - so either path can compute "how far did it just move" as a plain
  // delta and shift the crop mask's `clipPath` by the same amount,
  // keeping it visually attached regardless of which path is moving the
  // garment. Initialized once the garment actually loads (see that
  // effect below); `null` until then means "nothing to compare against
  // yet," not "moved by zero."
  const lastGarmentPosRef = useRef<{ left: number; top: number } | null>(null);

  // Found live while verifying Task 54: resizing the garment (width/height
  // sliders, or a direct corner-handle drag on canvas) after cropping left
  // the crop's clipPath at its old canvas-pixel size/position while the
  // garment grew/shrank around it - since `clipPath` is `absolutePositioned`
  // (canvas-space, not relative to the garment's own scale), the crop
  // window then covered a completely different, wrong-proportioned slice
  // of the now-differently-sized image. Confirmed live: cropped to the
  // right half of a test image, then doubled the width via the sidebar
  // slider - the clip's absolute left/top/width/height never changed, so
  // it ended up covering a much smaller, shifted fraction of the enlarged
  // image than intended, and the saved mask reproduced the same wrong
  // proportions on the persona. Same two-direction shape as the
  // mask-follows-garment fix above: tracks the garment's last known scale
  // so both the props-sync effect and the direct-drag handler can rescale
  // the clip by the same ratio the garment itself just scaled by, not just
  // shift it by a translation delta.
  const lastGarmentScaleRef = useRef<{ scaleX: number; scaleY: number } | null>(null);

  const mannequinUrl = personaType === PersonaType.MALE
    ? '/personas/male-base.png'
    : '/personas/female-base.png';

  // Initialize Canvas
  useEffect(() => {
    if (!canvasRef.current) return;

    customizeFabricControls();

    const canvas = new Canvas(canvasRef.current, {
      backgroundColor: 'transparent',
      preserveObjectStacking: true,
      selection: false,
    });

    // Task 52/53 bug fix: was a direct `fabricCanvasRef.current = canvas`
    // assignment - see useFabricCanvas's own comment on setFabricCanvas
    // for why that left the canvas at the browser's default 300x150 size
    // (blank-looking) until something else happened to resize the
    // container. setFabricCanvas re-applies the correct size immediately.
    setFabricCanvas(canvas);
    if (onCanvasReady) onCanvasReady(canvas);

    const handleModified = () => {
      const activeObject = canvas.getActiveObject();
      if (activeObject && activeObject.name === 'garment' && !isUpdatingRef.current) {
        // Task 53 (mask-follows-garment fix, the direct-drag path): this
        // fires on every 'object:moving' tick while the user is actively
        // dragging the garment on canvas - the actual, common way a
        // garment gets moved (there's no X/Y position slider in
        // TransformPanel, only direct canvas dragging). The earlier fix
        // in the "Sync Transform updates from props" effect below only
        // covers the *other* direction (React state pushing a position
        // onto the canvas), which direct dragging never goes through -
        // without this, the crop window would still visibly stay put
        // while the garment slides out from under it during the drag
        // itself, even though the final position eventually gets
        // recorded correctly. Same shift-by-delta approach, just applied
        // here instead: compare the garment's position now to where it
        // was on the last tick (tracked in `lastGarmentPosRef`, shared
        // with the other sync path so neither computes a delta against
        // stale data) and shift the clip by the same amount.
        const curLeft = activeObject.left ?? 0;
        const curTop = activeObject.top ?? 0;
        const curScaleX = activeObject.scaleX ?? 1;
        const curScaleY = activeObject.scaleY ?? 1;
        if (
          lastGarmentPosRef.current &&
          lastGarmentScaleRef.current &&
          activeObject.clipPath &&
          activeObject.clipPath.name === 'cropMask'
        ) {
          const deltaX = curLeft - lastGarmentPosRef.current.left;
          const deltaY = curTop - lastGarmentPosRef.current.top;
          const scaleRatioX = curScaleX / lastGarmentScaleRef.current.scaleX;
          const scaleRatioY = curScaleY / lastGarmentScaleRef.current.scaleY;
          if (deltaX !== 0 || deltaY !== 0 || scaleRatioX !== 1 || scaleRatioY !== 1) {
            const clip = activeObject.clipPath as Rect;
            const newClipLeft = curLeft + ((clip.left ?? 0) - lastGarmentPosRef.current.left) * scaleRatioX;
            const newClipTop = curTop + ((clip.top ?? 0) - lastGarmentPosRef.current.top) * scaleRatioY;
            // Resize via the clip's raw width/height, not scaleX/scaleY -
            // getVirtualTransform (called just below) reads clipPath.width/
            // height directly, not getScaledWidth()/getScaledHeight(), so a
            // clip built anywhere in this file (updateCrop included) always
            // keeps scaleX/scaleY at 1 and bakes size into width/height.
            clip.set({
              left: newClipLeft,
              top: newClipTop,
              width: (clip.width ?? 0) * scaleRatioX,
              height: (clip.height ?? 0) * scaleRatioY,
            });
          }
        }
        lastGarmentPosRef.current = { left: curLeft, top: curTop };
        lastGarmentScaleRef.current = { scaleX: curScaleX, scaleY: curScaleY };

        const virtualTransform = getVirtualTransform(activeObject, canvas.getWidth(), canvas.getHeight());
        onTransformChange({
          ...transformRef.current,
          ...virtualTransform,
        });
      }
    };

    canvas.on('object:modified', handleModified);
    canvas.on('object:scaling', handleModified);
    canvas.on('object:moving', handleModified);
    canvas.on('object:rotating', handleModified);

    return () => {
      canvas.dispose();
      setFabricCanvas(null);
    };
  }, []);

  // Handle Tool Changes (Crop)
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const garment = canvas.getObjects().find(obj => obj.name === 'garment');
    if (!garment) return;

    const existingCropBox = canvas.getObjects().find(obj => obj.name === 'cropBox');
    if (existingCropBox) canvas.remove(existingCropBox);

    if (activeTool === 'crop') {
      garment.set({ selectable: false });
      
      const canvasHeight = canvas.getHeight();
      
      // Initialize crop box at current mask position or fallback to 80% of garment
      const cropBox = new Rect({
        left: transform.maskWidth ? toCanvasCoord(transform.maskLeft!, canvasHeight) : garment.left,
        top: transform.maskHeight ? toCanvasCoord(transform.maskTop!, canvasHeight) : garment.top,
        width: transform.maskWidth ? toCanvasCoord(transform.maskWidth, canvasHeight) : garment.getScaledWidth() * 0.8,
        height: transform.maskHeight ? toCanvasCoord(transform.maskHeight, canvasHeight) : garment.getScaledHeight() * 0.8,
        fill: getStageAccentRgba(0.3),
        stroke: getStageAccentHex(),
        strokeWidth: 2,
        name: 'cropBox',
        originX: 'center',
        originY: 'center',
        cornerStyle: 'circle',
        cornerColor: '#FFF',
        transparentCorners: false,
      });

      canvas.add(cropBox);
      canvas.setActiveObject(cropBox);

      const updateCrop = () => {
        const clipRect = new Rect({
          left: cropBox.left,
          top: cropBox.top,
          width: cropBox.getScaledWidth(),
          height: cropBox.getScaledHeight(),
          originX: 'center',
          originY: 'center',
          name: 'cropMask',
          absolutePositioned: true
        });
        garment.set({ clipPath: clipRect });

        onTransformChange({
          ...transformRef.current,
          maskLeft: toVirtualCoord(cropBox.left!, canvas.getHeight()),
          maskTop: toVirtualCoord(cropBox.top!, canvas.getHeight()),
          maskWidth: toVirtualCoord(cropBox.getScaledWidth(), canvas.getHeight()),
          maskHeight: toVirtualCoord(cropBox.getScaledHeight(), canvas.getHeight()),
        });
        canvas.requestRenderAll();
      };

      cropBox.on('modified', updateCrop);
      cropBox.on('moving', updateCrop);
      cropBox.on('scaling', updateCrop);

    } else {
      garment.set({ selectable: true });
      canvas.setActiveObject(garment);
    }
    
    canvas.requestRenderAll();
  }, [activeTool]);

  // Load Mannequin and Garment
  useEffect(() => {
    let cancelled = false;

    const initObjects = async () => {
      const canvas = fabricCanvasRef.current;
      if (!canvas || canvasSize.height === 0) return;

      try {
        const [mannequin, garment] = await Promise.all([
          loadFabricImage(mannequinUrl),
          loadFabricImage(imageUrl)
        ]);

        if (cancelled) return;

        canvas.clear();

        mannequin.set({
          name: 'mannequin',
          originX: 'center',
          originY: 'center',
        });
        
        const mannequinScale = canvas.getHeight() / mannequin.height!;
        mannequin.scale(mannequinScale);
        
        centerObject(canvas, mannequin);
        lockObject(mannequin);
        canvas.add(mannequin);
        canvas.sendObjectToBack(mannequin);

        const canvasWidth = canvas.getWidth();
        const canvasHeight = canvas.getHeight();
        
        // Setup Garment
        garment.set({
          name: 'garment',
          originX: 'center',
          originY: 'center',
          left: toCanvasX(transform.x, canvasWidth, canvasHeight),
          top: toCanvasCoord(transform.y, canvasHeight),
          angle: transform.rotation,
          opacity: transform.opacity ?? 1,
          flipX: transform.flipX ?? false,
          flipY: transform.flipY ?? false,
          objectCaching: false,
          uniformScaling: false
        });

        // Apply scale based on absolute virtual width
        // If width is missing (new item), default to 450
        const virtualWidth = transform.width || 450;
        const targetWidth = toCanvasCoord(virtualWidth, canvasHeight);
        garment.scaleToWidth(targetWidth);

        // Apply mask if exists
        if (transform.maskWidth && transform.maskHeight) {
          garment.set({
            clipPath: new Rect({
              left: toCanvasX(transform.maskLeft!, canvasWidth, canvasHeight),
              top: toCanvasCoord(transform.maskTop!, canvasHeight),
              width: toCanvasCoord(transform.maskWidth, canvasHeight),
              height: toCanvasCoord(transform.maskHeight, canvasHeight),
              originX: 'center',
              originY: 'center',
              name: 'cropMask',
              absolutePositioned: true
            })
          });
        }

        canvas.add(garment);
        canvas.setActiveObject(garment);
        canvas.requestRenderAll();

        // Task 53 (mask-follows-garment fix): establishes the baseline
        // `handleModified`/the sync effect below compare against for
        // their first delta - without this, the first drag or programmatic
        // move after a (re)load would compare against `null` (correctly
        // skipped, per the guards in both places) or, worse, stale data
        // left over from a previous garment.
        lastGarmentPosRef.current = { left: garment.left ?? 0, top: garment.top ?? 0 };
        lastGarmentScaleRef.current = { scaleX: garment.scaleX ?? 1, scaleY: garment.scaleY ?? 1 };
      } catch (err) {
        console.error("Error loading images into Fabric canvas:", err);
      }
    };

    initObjects();
    return () => { cancelled = true; };
  }, [imageUrl, mannequinUrl, canvasSize]);

  // Sync Transform updates from props
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || isUpdatingRef.current) return;

    const garment = canvas.getObjects().find(obj => obj.name === 'garment');
    if (garment) {
      isUpdatingRef.current = true;
      const canvasWidth = canvas.getWidth();
      const canvasHeight = canvas.getHeight();

      // Task 53 (mask-follows-garment fix): the crop mask's clipPath is
      // `absolutePositioned: true` (canvas-space, not relative to the
      // garment's own transform - see the crop effect above), so without
      // this it stays fixed in place while the garment moves underneath
      // it - confirmed live as "moving a cropped garment slides it under
      // a stationary window." Capture how far the garment is about to
      // move, in the same canvas-pixel units the clip's own left/top are
      // stored in, and shift the clip by that same delta so it stays
      // visually attached, then persist the shifted position back into
      // `transform.maskLeft/maskTop` so a save/reload doesn't lose it -
      // the load effect above re-derives the clip from those fields, not
      // from whatever the live Fabric object happens to hold at the
      // moment of saving. Fixes translation (the reported case) and
      // keeps working under scaling too, since the delta is computed in
      // the same already-scaled canvas-pixel space the clip lives in.
      // Rotation is a known remaining gap: an absolutely-positioned,
      // axis-aligned clip can translate and resize with the object, but
      // can't rotate with it without also being re-expressed in the
      // garment's own local coordinate space - out of scope for this fix.
      const prevLeft = garment.left ?? 0;
      const prevTop = garment.top ?? 0;
      const prevScaleX = garment.scaleX ?? 1;
      const prevScaleY = garment.scaleY ?? 1;
      const newLeft = toCanvasX(transform.x, canvasWidth, canvasHeight);
      const newTop = toCanvasCoord(transform.y, canvasHeight);

      // getOriginalSize() only exists on FabricImage, not the generic
      // FabricObject canvas.getObjects().find(...) returns - the garment is
      // always a FabricImage in practice (loaded via loadFabricImage), but
      // the guard makes that provably safe instead of assumed.
      let newScaleX = prevScaleX;
      let newScaleY = prevScaleY;
      if (transform.width && transform.height && garment instanceof FabricImage) {
        const targetWidth = toCanvasCoord(transform.width, canvasHeight);
        const targetHeight = toCanvasCoord(transform.height, canvasHeight);
        const baseWidth = garment.getOriginalSize().width;
        const baseHeight = garment.getOriginalSize().height;
        newScaleX = targetWidth / baseWidth;
        newScaleY = targetHeight / baseHeight;
      }

      const deltaX = newLeft - prevLeft;
      const deltaY = newTop - prevTop;
      const scaleRatioX = newScaleX / prevScaleX;
      const scaleRatioY = newScaleY / prevScaleY;

      // Task 53 (mask-follows-garment fix) + its Task 54 follow-up (the
      // clip also needs to rescale, not just translate, when the garment's
      // width/height change - found live while verifying Task 54: cropping
      // then resizing via the sidebar sliders left the clip at its old
      // absolute canvas size/position while the image grew/shrank around
      // it, so the crop window ended up covering a wrong, mismatched
      // fraction of the resized image). Both deltas collapse to a no-op
      // (ratio 1, delta 0) when neither position nor size actually
      // changed, so this single block safely covers plain moves, plain
      // resizes, and both at once.
      if ((deltaX !== 0 || deltaY !== 0 || scaleRatioX !== 1 || scaleRatioY !== 1) && garment.clipPath && garment.clipPath.name === 'cropMask') {
        const clip = garment.clipPath as Rect;
        const newClipLeft = newLeft + ((clip.left ?? 0) - prevLeft) * scaleRatioX;
        const newClipTop = newTop + ((clip.top ?? 0) - prevTop) * scaleRatioY;
        // Resize via the clip's raw width/height, not scaleX/scaleY -
        // getVirtualTransform reads clipPath.width/height directly, not
        // getScaledWidth()/getScaledHeight(), so a clip built anywhere in
        // this file (updateCrop included) always keeps scaleX/scaleY at 1
        // and bakes size into width/height.
        const newClipWidth = (clip.width ?? 0) * scaleRatioX;
        const newClipHeight = (clip.height ?? 0) * scaleRatioY;
        clip.set({ left: newClipLeft, top: newClipTop, width: newClipWidth, height: newClipHeight });
        onTransformChange({
          ...transformRef.current,
          maskLeft: toVirtualCoord(newClipLeft, canvasHeight),
          maskTop: toVirtualCoord(newClipTop, canvasHeight),
          maskWidth: toVirtualCoord(newClipWidth, canvasHeight),
          maskHeight: toVirtualCoord(newClipHeight, canvasHeight),
        });
      }

      garment.set({
        left: newLeft,
        top: newTop,
        angle: transform.rotation,
        opacity: transform.opacity ?? 1,
        flipX: transform.flipX ?? false,
        flipY: transform.flipY ?? false,
        scaleX: newScaleX,
        scaleY: newScaleY,
      });

      garment.setCoords();
      // Keep the shared "last known position/scale" refs in sync with
      // whatever this pass just set, so a subsequent direct canvas drag
      // (`handleModified` above) computes its own delta/ratio against this
      // pass's result instead of stale data from before it ran.
      lastGarmentPosRef.current = { left: garment.left ?? 0, top: garment.top ?? 0 };
      lastGarmentScaleRef.current = { scaleX: garment.scaleX ?? 1, scaleY: garment.scaleY ?? 1 };
      canvas.requestRenderAll();
      isUpdatingRef.current = false;
    }
  }, [transform.x, transform.y, transform.width, transform.height, transform.rotation, transform.opacity, transform.flipX, transform.flipY]);

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full min-h-[500px] flex items-center justify-center bg-stage rounded-2xl overflow-hidden border border-white/10 shadow-inner"
    >
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(${getStageAccentHex()} 1px, transparent 1px)`,
          backgroundSize: '30px 30px' 
        }} 
      />
      <canvas ref={canvasRef} />
      {/* Task 71: text-primary/accent would follow the site theme and turn
          near-black in light mode - invisible on this stage, which stays
          dark in both themes (see index.css). Fixed light colors instead,
          same reasoning as the white captions kept on photo thumbnails. */}
      <div className="absolute bottom-6 left-6 flex items-center gap-4 opacity-40 pointer-events-none">
        <div className="flex flex-col gap-1">
          <p className="text-[10px] font-medium tracking-[0.4em] text-white/80 uppercase">Fabric.js v7.4 Core</p>
          <p className="text-[10px] font-medium tracking-[0.4em] text-stage-accent uppercase">Absolute Virtual Engine</p>
        </div>
      </div>
    </div>
  );
};

export default ClothingCanvas;
