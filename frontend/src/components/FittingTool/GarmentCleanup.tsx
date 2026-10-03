import React, { useEffect, useRef, useState } from 'react';
import {
  Eraser,
  Undo2,
  Redo2,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Brush,
  Save,
  Hand,
  Sparkles,
  Info,
  Loader2
} from 'lucide-react';
import { Canvas, Circle, Group, Image as FabricImage, PencilBrush, Point, util, type FabricObject } from 'fabric';
import { useFabricCanvas, measureContainerWithRetry } from '../../hooks/useFabricCanvas';
import { getStageAccentHex } from '../../utils/themeColors';
import { rescaleObjects } from '../editor/CanvasUtils';
import { alphaBounds, padBox } from '../../utils/alphaBounds';

// What the edit flow ('image-bounds' export) reports besides the picture.
export interface CleanupResult {
  // Whether anything was erased or restored.
  edited: boolean;
  // Set when the picture was cropped to the garment: where the crop sits inside
  // the full (untrimmed) picture, in the exported pixel size. The garment's
  // saved fit refers to the full picture, so the caller must retarget it.
  trim: { x: number; y: number; width: number; height: number; fullWidth: number; fullHeight: number } | null;
}

interface GarmentCleanupProps {
  imageUrl: string;
  onComplete: (cleanedImageUrl: string, result?: CleanupResult) => void;
  // Without it there is no Skip button (the edit flow has none: finishing is
  // how a picture gets trimmed to the garment, even with nothing erased).
  onSkip?: () => void;
  onBack: () => void;
  // 'canvas' (the upload flow's original behavior): the PNG is the whole
  // canvas, transparent margins included. 'image-bounds' (Task 83, the edit
  // flow): only the garment's own rectangle, at the source image's pixel
  // size, so the cleaned image keeps the aspect ratio and framing the item's
  // saved fit was made for.
  exportMode?: 'canvas' | 'image-bounds';
  // The upload flow skips the AI cutout ("Skip AI"); an existing garment has
  // no AI step to skip, so the edit flow just says "Skip".
  skipLabel?: string;
}

type ToolMode = 'erase' | 'restore' | 'pan';

// Largest side (px) of an 'image-bounds' export - a very large photo is scaled
// down rather than risking the browser's canvas size limit.
const MAX_EXPORT_SIDE = 4096;

// An edit export is only cropped to the garment when that drops at least this
// much of the picture (a picture already framed tightly is left alone).
const TRIM_MAX_AREA = 0.95;

// How much of the canvas the garment fills when the studio opens.
const FIT_FRACTION = 0.92;

// Bounding box (in the image's own pixels) of everything that isn't
// transparent. Falls back to the whole image if the pixels can't be read.
const opaqueBounds = (
  source: CanvasImageSource,
  width: number,
  height: number
): { x: number; y: number; width: number; height: number } => {
  const whole = { x: 0, y: 0, width, height };
  try {
    // Scan a reduced copy: a phone photo is millions of pixels.
    const shrink = Math.min(1, 512 / Math.max(width, height));
    const w = Math.max(1, Math.round(width * shrink));
    const h = Math.max(1, Math.round(height * shrink));
    const scratch = document.createElement('canvas');
    scratch.width = w;
    scratch.height = h;
    const ctx = scratch.getContext('2d');
    if (!ctx) return whole;
    ctx.drawImage(source, 0, 0, w, h);
    const box = alphaBounds(ctx.getImageData(0, 0, w, h).data, w, h);
    if (!box) return whole; // fully transparent
    return {
      x: box.x / shrink,
      y: box.y / shrink,
      width: box.width / shrink,
      height: box.height / shrink,
    };
  } catch {
    // e.g. a tainted canvas (image without CORS headers)
    return whole;
  }
};

// The add-garment export used to be the whole canvas: a wide picture with big
// transparent margins, so the studio's selection box and warp points sat on the
// picture's edges, far from the garment. Crop to what is actually visible
// (plus a small margin). Falls back to the untrimmed canvas if it can't be read.
const trimToGarment = (source: HTMLCanvasElement): string => {
  try {
    const ctx = source.getContext('2d');
    if (!ctx) return source.toDataURL('image/png');
    const box = alphaBounds(ctx.getImageData(0, 0, source.width, source.height).data, source.width, source.height);
    if (!box) return source.toDataURL('image/png');
    const crop = padBox(box, source.width, source.height);
    const out = document.createElement('canvas');
    out.width = crop.width;
    out.height = crop.height;
    out.getContext('2d')!.drawImage(source, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
    return out.toDataURL('image/png');
  } catch {
    return source.toDataURL('image/png');
  }
};

const findBaseImage = (canvas: Canvas) =>
  canvas.getObjects().find((obj) => (obj as FabricObject & { isBaseImage?: boolean }).isBaseImage) as
    | FabricImage
    | undefined;

// A brush stroke as a filled shape. Fabric uses only the FILL of a clip path
// (never its stroke), and a freehand line has no fill area, so the stroke is
// rebuilt as a run of filled circles the brush's width, in scene coordinates.
const strokeToBand = (path: FabricObject): Group => {
  const { path: commands, pathOffset } = path as unknown as {
    path: Array<Array<string | number>>;
    pathOffset: Point;
  };
  const matrix = path.calcTransformMatrix();
  const points: Point[] = [];
  commands.forEach((command) => {
    if (command.length < 3) return; // 'Z' has no point
    const x = Number(command[command.length - 2]);
    const y = Number(command[command.length - 1]);
    points.push(util.transformPoint(new Point(x - pathOffset.x, y - pathOffset.y), matrix));
  });

  const radius = Math.max(0.5, ((path.strokeWidth ?? 1) * Math.abs(path.scaleX ?? 1)) / 2);
  // Circles closer than half a radius overlap enough to read as a solid line.
  let step = radius / 2;
  const length = points.slice(1).reduce((sum, p, i) => sum + p.distanceFrom(points[i]), 0);
  step = Math.max(step, length / 3000); // bound the circle count on huge strokes

  const centers: Point[] = points.length ? [points[0]] : [];
  for (let i = 1; i < points.length; i++) {
    const from = points[i - 1];
    const to = points[i];
    const steps = Math.max(1, Math.ceil(from.distanceFrom(to) / step));
    for (let k = 1; k <= steps; k++) {
      centers.push(new Point(from.x + ((to.x - from.x) * k) / steps, from.y + ((to.y - from.y) * k) / steps));
    }
  }

  return new Group(
    centers.map(
      (c) =>
        new Circle({
          left: c.x,
          top: c.y,
          radius,
          originX: 'center',
          originY: 'center',
          fill: 'black',
          strokeWidth: 0,
        })
    ),
    { absolutePositioned: true }
  );
};

// Restore brush: paints the garment's ORIGINAL pixels back. The stroke becomes
// the clip of a fresh copy of the untouched base image, stacked above whatever
// was erased before it (and below whatever is erased after). Before Task 83
// Restore just behaved as a second Erase.
const restoreStroke = async (canvas: Canvas, path: FabricObject) => {
  const base = findBaseImage(canvas);
  if (!base) return;
  const original = await base.clone();
  const band = strokeToBand(path);
  canvas.remove(path);
  original.set({ selectable: false, evented: false, clipPath: band });
  canvas.add(original);
};

const GarmentCleanup: React.FC<GarmentCleanupProps> = ({
  imageUrl,
  onComplete,
  onSkip,
  onBack,
  exportMode = 'canvas',
  skipLabel = 'Skip AI',
}) => {
  // No aspectRatio passed - this editor sizes its canvas once at creation
  // (see measureContainerWithRetry below) and never resizes it afterward,
  // unlike the other editors, so it doesn't use the hook's resize-fitting.
  const { canvasRef, fabricCanvasRef, containerRef } = useFabricCanvas();

  const [mode, setMode] = useState<ToolMode>('erase');
  // The canvas event handlers below are registered once (the init effect only
  // re-runs for a new image), so they read the current tool through a ref -
  // a plain `mode` there stays frozen at 'erase' forever.
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const [brushSize, setBrushSize] = useState(30);
  const [zoom, setZoom] = useState(1);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // History for Undo/Redo
  const history = useRef<string[]>([]);
  const historyIndex = useRef(-1);

  const updateHistoryButtons = () => {
    setCanUndo(historyIndex.current > 0);
    setCanRedo(historyIndex.current < history.current.length - 1);
  };

  const saveHistory = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    // The custom flags must be listed or they're dropped from the snapshot
    // (and Undo/Redo would lose track of the base image and eraser strokes).
    const json = JSON.stringify(canvas.toObject(['isBaseImage', 'isEraserPath']));
    
    if (historyIndex.current < history.current.length - 1) {
      history.current = history.current.slice(0, historyIndex.current + 1);
    }

    history.current.push(json);
    historyIndex.current = history.current.length - 1;
    updateHistoryButtons();
  };

  const loadFromHistory = async () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const json = history.current[historyIndex.current];
    await canvas.loadFromJSON(json);
    
    // After loading, we must ensure all paths in 'erase' mode maintain their composite op
    canvas.getObjects().forEach(obj => {
      if (obj.type === 'path' && (obj as any).isEraserPath) {
        obj.globalCompositeOperation = 'destination-out';
      }
    });
    
    canvas.renderAll();
    updateHistoryButtons();
  };

  const handleUndo = () => {
    if (historyIndex.current > 0) {
      historyIndex.current--;
      loadFromHistory();
    }
  };

  const handleRedo = () => {
    if (historyIndex.current < history.current.length - 1) {
      historyIndex.current++;
      loadFromHistory();
    }
  };

  const handleReset = async () => {
    if (history.current.length > 0) {
      history.current = [history.current[0]];
      historyIndex.current = 0;
      loadFromHistory();
    }
  };

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    let canvas: Canvas;
    let isDisposed = false;
    // Everything registered outside the canvas (window key listeners, the
    // resize observer) - released when the effect is torn down.
    const disposers: Array<() => void> = [];
    // Set once the picture has loaded (see the fit code below).
    let fitFor: ((width: number, height: number) => { scale: number; left: number; top: number }) | null = null;

    const init = async () => {
      const dimensions = await measureContainerWithRetry(containerRef.current);

      if (isDisposed || dimensions.width === 0) return;

      canvas = new Canvas(canvasRef.current!, {
        width: dimensions.width,
        height: dimensions.height,
        backgroundColor: 'transparent',
        isDrawingMode: true,
        enableRetinaScaling: true
      });

      fabricCanvasRef.current = canvas;

      try {
        const isLocalBlob = imageUrl.startsWith('blob:');
        const img = await FabricImage.fromURL(imageUrl, isLocalBlob ? {} : { crossOrigin: 'anonymous' });
        
        if (isDisposed) return;

        // Fit the garment itself (not the whole picture, which often carries
        // a wide transparent margin) into the canvas, and center it.
        const box = opaqueBounds(img.getElement() as CanvasImageSource, img.width!, img.height!);
        // Where the picture must sit (center point + scale) for the garment
        // to fill a canvas of the given size. Also used on every resize.
        fitFor = (width, height) => {
          const scale = Math.min((width * FIT_FRACTION) / box.width, (height * FIT_FRACTION) / box.height);
          return {
            scale,
            left: width / 2 - (box.x + box.width / 2 - img.width! / 2) * scale,
            top: height / 2 - (box.y + box.height / 2 - img.height! / 2) * scale,
          };
        };
        const start = fitFor(canvas.width!, canvas.height!);

        img.set({
          scaleX: start.scale,
          scaleY: start.scale,
          left: start.left,
          top: start.top,
          originX: 'center',
          originY: 'center',
          selectable: false,
          evented: false,
          // @ts-ignore
          isBaseImage: true
        });

        canvas.add(img);
        
        // Initial Brush Setup
        updateBrush(canvas, mode);

        canvas.renderAll();
        saveHistory();
        setIsReady(true);
      } catch (err) {
        console.error("Cleanup Studio Error:", err);
        setIsReady(true);
      }

      canvas.on('path:created', async (opt) => {
        const path = opt.path;
        if (modeRef.current === 'restore') {
          await restoreStroke(canvas, path);
        } else {
          // EXPLICITLY set the composite operation on the path itself
          path.set({
            globalCompositeOperation: 'destination-out',
            // @ts-ignore
            isEraserPath: true
          });
        }
        canvas.renderAll();
        saveHistory();
      });
      
      // Wheel Zoom
      canvas.on('mouse:wheel', (opt) => {
        const delta = opt.e.deltaY;
        let zoomVal = canvas.getZoom();
        zoomVal *= 0.999 ** delta;
        if (zoomVal > 10) zoomVal = 10;
        if (zoomVal < 0.5) zoomVal = 0.5;
        canvas.zoomToPoint(new Point(opt.e.offsetX, opt.e.offsetY), zoomVal);
        setZoom(zoomVal);
        opt.e.preventDefault();
        opt.e.stopPropagation();
      });

      // Space Pan
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.code === 'Space') {
          canvas.isDrawingMode = false;
          canvas.defaultCursor = 'grab';
        }
      };
      const handleKeyUp = (e: KeyboardEvent) => {
        if (e.code === 'Space') {
          canvas.isDrawingMode = true;
          canvas.defaultCursor = 'crosshair';
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
      disposers.push(() => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
      });

      // Task 83: this canvas was sized once and never again, so resizing the
      // window (or the dialog still growing when it first opened) left it the
      // wrong size, or the garment tiny / cut off. Now it follows its
      // container and re-fits the garment to it; everything drawn on top
      // (erase / restore strokes) moves and scales with the picture.
      let lastWidth = dimensions.width;
      let lastHeight = dimensions.height;
      const observer = new ResizeObserver(() => {
        const el = containerRef.current;
        if (!el || isDisposed) return;
        const width = el.offsetWidth;
        const height = el.offsetHeight;
        if (width === 0 || height === 0 || (width === lastWidth && height === lastHeight)) return;
        canvas.setDimensions({ width, height });
        const base = findBaseImage(canvas);
        if (fitFor && base) {
          const next = fitFor(width, height);
          rescaleObjects(
            canvas,
            next.scale / (base.scaleX ?? 1),
            { x: base.left ?? 0, y: base.top ?? 0 },
            { x: next.left, y: next.top }
          );
        }
        lastWidth = width;
        lastHeight = height;
        canvas.requestRenderAll();
      });
      if (containerRef.current) observer.observe(containerRef.current);
      disposers.push(() => observer.disconnect());

      let isPanning = false;
      canvas.on('mouse:down', (opt) => {
        // TPointerEvent is MouseEvent | TouchEvent | PointerEvent - only the
        // first and third carry clientX/clientY directly. Panning is
        // mouse/pointer-only (this canvas has no touch-drag support), so a
        // TouchEvent here just skips starting a pan rather than corrupting
        // the viewport transform with NaN as it silently did before.
        if ((!canvas.isDrawingMode || opt.e.altKey) && 'clientX' in opt.e) {
          isPanning = true;
          canvas.selection = false;
          canvas.lastPosX = opt.e.clientX;
          canvas.lastPosY = opt.e.clientY;
        }
      });
      canvas.on('mouse:move', (opt) => {
        if (isPanning && 'clientX' in opt.e) {
          const e = opt.e;
          const vpt = canvas.viewportTransform!;
          vpt[4] += e.clientX - canvas.lastPosX;
          vpt[5] += e.clientY - canvas.lastPosY;
          canvas.requestRenderAll();
          canvas.lastPosX = e.clientX;
          canvas.lastPosY = e.clientY;
        }
      });
      canvas.on('mouse:up', () => { isPanning = false; });
    };

    init();

    return () => {
      isDisposed = true;
      disposers.forEach((dispose) => dispose());
      if (canvas) canvas.dispose();
    };
  }, [imageUrl]);

  const updateBrush = (canvas: Canvas, currentMode: ToolMode) => {
    if (!canvas) return;

    if (currentMode === 'pan') {
      canvas.isDrawingMode = false;
      return;
    }

    canvas.isDrawingMode = true;
    const brush = new PencilBrush(canvas);
    brush.width = brushSize;
    
    if (currentMode === 'erase') {
      brush.color = 'black'; // Color doesn't matter for destination-out
      // @ts-ignore
      brush.globalCompositeOperation = 'destination-out';
    } else {
      // Only the live preview stroke: on release it becomes a clip of the
      // original image (see restoreStroke), so the color never ends up in
      // the result.
      brush.color = 'white';
      // @ts-ignore
      brush.globalCompositeOperation = 'source-over';
    }

    canvas.freeDrawingBrush = brush;
    
    // Cursor matches brush size
    const cursor = `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="${brushSize}" height="${brushSize}" viewBox="0 0 ${brushSize} ${brushSize}"><circle cx="${brushSize/2}" cy="${brushSize/2}" r="${brushSize/2 - 1}" style="fill:none;stroke:white;stroke-width:1;opacity:0.5"/></svg>') ${brushSize/2} ${brushSize/2}, crosshair`;
    canvas.freeDrawingCursor = cursor;
  };

  useEffect(() => {
    if (fabricCanvasRef.current && isReady) {
      updateBrush(fabricCanvasRef.current, mode);
    }
  }, [mode, brushSize, isReady]);

  // Sidebar zoom buttons (only the mouse wheel used to zoom): zoom about the
  // center of the canvas.
  const zoomBy = (factor: number) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    const next = Math.min(10, Math.max(0.5, canvas.getZoom() * factor));
    canvas.zoomToPoint(new Point(canvas.getWidth() / 2, canvas.getHeight() / 2), next);
    setZoom(next);
  };

  const handleFinish = () => {
    let result: CleanupResult | undefined;
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    setIsProcessing(true);

    // Snapshot with proper scale
    const vpt = canvas.viewportTransform;
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);

    const base = findBaseImage(canvas);
    let dataUrl: string;
    if (exportMode === 'image-bounds' && base) {
      // Just the garment's rectangle, at (up to) its source pixel size.
      const bounds = base.getBoundingRect();
      const naturalWidth = base.width ?? bounds.width;
      const naturalHeight = base.height ?? bounds.height;
      const shrink = Math.min(1, MAX_EXPORT_SIDE / Math.max(naturalWidth, naturalHeight));
      // Exact pixel size (the bounds are fractional, so a plain toDataURL
      // region can come out a pixel short and slightly change the aspect).
      const outWidth = Math.round(naturalWidth * shrink);
      const outHeight = Math.round(naturalHeight * shrink);
      const region = canvas.toCanvasElement(outWidth / bounds.width, {
        left: bounds.left,
        top: bounds.top,
        width: bounds.width,
        height: bounds.height,
      });
      const out = document.createElement('canvas');
      out.width = outWidth;
      out.height = outHeight;
      const outCtx = out.getContext('2d')!;
      outCtx.drawImage(region, 0, 0, outWidth, outHeight);

      // Crop to the visible garment when the picture has real margins: the
      // studio's selection box and the warp points sit on the picture's edges,
      // so a loose picture leaves them far from the garment.
      let trim: CleanupResult['trim'] = null;
      try {
        const box = alphaBounds(outCtx.getImageData(0, 0, outWidth, outHeight).data, outWidth, outHeight);
        if (box) {
          const crop = padBox(box, outWidth, outHeight);
          if (crop.width * crop.height < outWidth * outHeight * TRIM_MAX_AREA) {
            trim = { ...crop, fullWidth: outWidth, fullHeight: outHeight };
          }
        }
      } catch {
        // Unreadable pixels: export untrimmed.
      }

      if (trim) {
        const cropped = document.createElement('canvas');
        cropped.width = trim.width;
        cropped.height = trim.height;
        cropped.getContext('2d')!.drawImage(out, trim.x, trim.y, trim.width, trim.height, 0, 0, trim.width, trim.height);
        dataUrl = cropped.toDataURL('image/png');
      } else {
        dataUrl = out.toDataURL('image/png');
      }
      result = { edited: historyIndex.current > 0, trim };
    } else {
      dataUrl = trimToGarment(canvas.toCanvasElement(2));
    }

    if (vpt) canvas.setViewportTransform(vpt);
    
    onComplete(dataUrl, result);
    setIsProcessing(false);
  };

  if (!imageUrl) return null;

  return (
    <div className={`flex flex-col h-full space-y-3 lg:space-y-6 transition-all duration-700 ${isReady ? 'opacity-100' : 'opacity-0 scale-95'}`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between px-1 lg:px-2 shrink-0">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Sparkles className="text-accent" size={20} />
            <h2 className="text-xl lg:text-3xl font-light tracking-tighter text-text-primary uppercase italic">Cleanup Studio</h2>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-[10px] font-medium tracking-widest text-text-secondary uppercase opacity-40">
            <Info size={10} />
            <span>Erase mannequin pieces, inner shirts, or artifacts</span>
          </div>
        </div>

        <div className="grid grid-cols-3 lg:flex bg-ink/5 rounded-2xl p-1 border border-ink/5">
           <button onClick={() => setMode('erase')} className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-medium uppercase tracking-widest transition-all ${mode === 'erase' ? 'bg-accent text-on-accent' : 'text-text-secondary hover:text-text-primary'}`}><Eraser size={12} /><span>Erase</span></button>
           <button onClick={() => setMode('restore')} className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-medium uppercase tracking-widest transition-all ${mode === 'restore' ? 'bg-emerald-500 text-white' : 'text-text-secondary hover:text-text-primary'}`}><Brush size={12} /><span>Restore</span></button>
           <button onClick={() => setMode('pan')} className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-medium uppercase tracking-widest transition-all ${mode === 'pan' ? 'bg-ink/10 text-text-primary' : 'text-text-secondary hover:text-text-primary'}`}><Hand size={12} /><span>Pan</span></button>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-3 lg:gap-6 overflow-y-auto lg:overflow-hidden no-scrollbar">
        <aside className="order-2 lg:order-1 w-full lg:w-20 flex flex-row lg:flex-col items-center justify-around lg:justify-start gap-1 lg:gap-4 py-2 lg:py-6 bg-ink/[0.02] border border-ink/5 rounded-2xl shrink-0">
          <button disabled={!canUndo} onClick={handleUndo} className={`p-3 lg:p-4 rounded-2xl transition-all ${canUndo ? 'text-text-primary hover:bg-ink/5' : 'text-ink/10 cursor-not-allowed'}`}><Undo2 size={20} /></button>
          <button disabled={!canRedo} onClick={handleRedo} className={`p-3 lg:p-4 rounded-2xl transition-all ${canRedo ? 'text-text-primary hover:bg-ink/5' : 'text-ink/10 cursor-not-allowed'}`}><Redo2 size={20} /></button>
          <div className="h-8 w-px lg:h-px lg:w-10 bg-ink/5 lg:my-2" />
          <button onClick={() => zoomBy(1.25)} className="p-3 lg:p-4 rounded-2xl text-text-secondary hover:text-text-primary transition-all"><ZoomIn size={20} /></button>
          <button onClick={() => zoomBy(0.8)} className="p-3 lg:p-4 rounded-2xl text-text-secondary hover:text-text-primary transition-all"><ZoomOut size={20} /></button>
          <button onClick={handleReset} className="p-3 lg:p-4 rounded-2xl text-red-400/40 hover:text-red-400 transition-all lg:mt-auto"><RotateCcw size={20} /></button>
        </aside>

        {/* Task 71: bg-stage, not a theme token - this editing surface stays
            a dark backdrop in both site themes (see index.css). The dot
            grid now matches the accent the other 3 canvas stages use,
            instead of this one alone using plain white. */}
        <main ref={containerRef} className="order-1 lg:order-2 shrink-0 lg:shrink h-[46dvh] min-h-[16rem] lg:h-auto lg:flex-1 min-w-0 relative bg-stage rounded-2xl border border-white/10 overflow-hidden group">
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: `radial-gradient(${getStageAccentHex()} 1px, transparent 1px)`, backgroundSize: '24px 24px' }} />
          <canvas ref={canvasRef} />
          <div className="absolute bottom-3 left-3 lg:bottom-8 lg:left-8 flex items-center gap-2 lg:gap-4">
             <div className="px-4 py-2 bg-black/60 backdrop-blur-md rounded-2xl border border-white/5 text-[10px] font-medium uppercase text-white/50">Zoom: {Math.round(zoom * 100)}%</div>
             <div className="px-4 py-2 bg-black/60 backdrop-blur-md rounded-2xl border border-white/5 text-[10px] font-medium uppercase text-white/50">Mode: {mode}</div>
          </div>
        </main>

        <aside className="order-3 w-full lg:w-72 flex flex-col gap-3 lg:gap-6 shrink-0">
          <div className="bg-ink/[0.02] border border-ink/5 rounded-2xl p-4 lg:p-8 space-y-4 lg:space-y-8 backdrop-blur-xl">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-accent">
                <Brush size={14} />
                <span className="text-[10px] font-medium uppercase tracking-[0.2em]">Brush Size</span>
              </div>
              <div className="flex justify-between text-[10px] font-medium text-text-secondary opacity-60"><span>{brushSize}px</span></div>
              <input type="range" min="5" max="150" value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value))} className="w-full h-1 touch:h-2 touch:my-2 bg-ink/5 rounded-full appearance-none cursor-pointer accent-accent" />
            </div>
          </div>

          <div className="lg:mt-auto space-y-3 lg:space-y-4 pb-2">
            <button onClick={handleFinish} disabled={isProcessing} className="w-full py-4 lg:py-7 bg-accent hover:bg-accent-hover text-on-accent rounded-2xl font-medium text-xs tracking-[0.3em] lg:tracking-[0.5em] uppercase transition-all shadow-lg flex items-center justify-center gap-3">
              {isProcessing ? <Loader2 className="animate-spin" size={20} /> : <Save size={18} />}
              <span>Finalize & Next</span>
            </button>
            <div className="grid grid-cols-2 gap-3 lg:gap-4">
              <button onClick={onBack} className={`py-4 lg:py-5 bg-ink/5 hover:bg-ink/10 text-text-primary rounded-xl font-medium text-[10px] tracking-[0.3em] uppercase transition-all ${onSkip ? '' : 'col-span-2'}`}>Back</button>
              {onSkip && (
                <button onClick={onSkip} className="py-4 lg:py-5 bg-ink/5 hover:bg-ink/10 text-text-secondary hover:text-text-primary rounded-xl font-medium text-[10px] uppercase transition-all">{skipLabel}</button>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default GarmentCleanup;
