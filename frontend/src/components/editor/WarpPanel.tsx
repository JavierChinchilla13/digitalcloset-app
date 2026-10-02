import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { ClothingTransform } from '../../types';
import {
  WARP_GRID,
  identityGrid,
  renderWarpedMesh,
  bakeWarp,
  applyAffine,
  invertAffine,
  type Affine,
  type BakeResult,
  type WarpPoint,
} from '../../utils/meshWarp';
import type { WarpData } from '../../utils/warpData';
import { CANVAS_PAD, toCanvasCoord, toCanvasX } from './CanvasUtils';
import { getStageAccentHex } from '../../utils/themeColors';

export interface WarpApplyResult {
  grid: WarpPoint[];
  sourceWidth: number;
  sourceHeight: number;
  bake: BakeResult;
}

interface WarpPanelProps {
  // The ORIGINAL (unwarped) image - re-warping always starts from it, never
  // from a previously baked result.
  sourceUrl: string;
  // The item's existing warp, if any: supplies the starting control points and
  // tells us the size/center of the baked image the transform currently refers to.
  warp: WarpData | null;
  // Size (px) of the studio's stage. Task 84: the panel is no longer a screen
  // of its own - it is drawn over the studio canvas (ClothingCanvas's overlay
  // slot, which covers the stage plus its CANVAS_PAD margin), so the garment
  // is warped exactly where it sits, on the persona the studio already draws.
  stageWidth: number;
  stageHeight: number;
  // The garment's current placement in the studio.
  transform: ClothingTransform;
  // Applying a warp drops any crop (it was framed against the old image).
  hasCrop: boolean;
  onApply: (result: WarpApplyResult) => Promise<void>;
  onCancel: () => void;
}

const HANDLE_RADIUS = 9;
const HIT_RADIUS = 18;
// How far past the stage edge a point may be dragged. The overlay canvas has a
// CANVAS_PAD margin around the stage, so a handle (radius + its outline) that
// far out still fits inside it - every point stays grabbable.
const POINT_MARGIN = CANVAS_PAD - HANDLE_RADIUS - 4;

// Warp-space (source px) -> stage px: places the image where the garment sits
// in the studio - centered on its (x, y), scaled to its width/height, rotated
// and flipped like the garment. When the item is already warped the transform
// describes the *baked* image, whose center sits at the original's center plus
// the recorded shift.
export function garmentToStageMatrix(
  source: { w: number; h: number },
  warp: Pick<WarpData, 'bakedWidth' | 'bakedHeight' | 'shift'> | null,
  transform: Pick<ClothingTransform, 'x' | 'y' | 'width' | 'height' | 'rotation' | 'flipX' | 'flipY'>,
  stageW: number,
  stageH: number
): Affine {
  const current = warp ? { w: warp.bakedWidth, h: warp.bakedHeight } : source;
  const anchor = warp
    ? { x: source.w / 2 + warp.shift.x, y: source.h / 2 + warp.shift.y }
    : { x: source.w / 2, y: source.h / 2 };

  const width = transform.width || 450;
  const height = transform.height || (width * current.h) / current.w;
  const s = stageH / 1000;
  const kx = (width / current.w) * s * (transform.flipX ? -1 : 1);
  const ky = (height / current.h) * s * (transform.flipY ? -1 : 1);
  const theta = ((transform.rotation || 0) * Math.PI) / 180;

  const a = kx * Math.cos(theta);
  const b = kx * Math.sin(theta);
  const c = -ky * Math.sin(theta);
  const d = ky * Math.cos(theta);
  const cx = toCanvasX(transform.x, stageW, stageH);
  const cy = toCanvasCoord(transform.y, stageH);
  return { a, b, c, d, e: cx - (a * anchor.x + c * anchor.y), f: cy - (b * anchor.x + d * anchor.y) };
}

// Keeps a dragged point where its handle still fits inside the overlay canvas
// (the stage plus POINT_MARGIN on every side).
export function clampStagePoint(p: WarpPoint, stageW: number, stageH: number): WarpPoint {
  return {
    x: Math.min(Math.max(p.x, -POINT_MARGIN), stageW + POINT_MARGIN),
    y: Math.min(Math.max(p.y, -POINT_MARGIN), stageH + POINT_MARGIN),
  };
}

const WarpPanel: React.FC<WarpPanelProps> = ({
  sourceUrl,
  warp,
  stageWidth: stageW,
  stageHeight: stageH,
  transform,
  hasCrop,
  onApply,
  onCancel,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const dragIndexRef = useRef<number | null>(null);

  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [grid, setGrid] = useState<WarpPoint[]>(warp?.grid ?? []);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  // Garment image.
  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (cancelled) return;
      imgRef.current = img;
      setSize({ w: img.naturalWidth, h: img.naturalHeight });
      setGrid((prev) => (prev.length === WARP_GRID * WARP_GRID ? prev : identityGrid(img.naturalWidth, img.naturalHeight)));
    };
    img.onerror = () => {
      if (!cancelled) setLoadError('Could not load the image to warp.');
    };
    img.src = sourceUrl;
    return () => {
      cancelled = true;
    };
  }, [sourceUrl]);

  const canvasW = stageW + 2 * CANVAS_PAD;
  const canvasH = stageH + 2 * CANVAS_PAD;
  // Crisp on high-DPI screens; capped so a large stage doesn't get huge.
  const dpr = Math.min(typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1, 2);

  const matrix: Affine | null = useMemo(
    () => (size ? garmentToStageMatrix(size, warp, transform, stageW, stageH) : null),
    [size, warp, transform.x, transform.y, transform.width, transform.height, transform.rotation, transform.flipX, transform.flipY, stageW, stageH]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !size || !matrix || grid.length !== WARP_GRID * WARP_GRID) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // `matrix` maps to stage coordinates; the canvas also holds the handle
    // margin, and is drawn at device resolution. Both are folded into the
    // matrix (rather than a context transform) because renderWarpedMesh sets
    // each triangle's transform absolutely.
    const drawMatrix: Affine = {
      a: matrix.a * dpr,
      b: matrix.b * dpr,
      c: matrix.c * dpr,
      d: matrix.d * dpr,
      e: (matrix.e + CANVAS_PAD) * dpr,
      f: (matrix.f + CANVAS_PAD) * dpr,
    };
    // Everything else is drawn in css px.
    const toCss = (p: WarpPoint): WarpPoint => {
      const m = applyAffine(matrix, p);
      return { x: m.x + CANVAS_PAD, y: m.y + CANVAS_PAD };
    };

    // The warped garment, at the garment's own opacity.
    ctx.globalAlpha = transform.opacity ?? 1;
    renderWarpedMesh(ctx, img, size.w, size.h, grid, drawMatrix, 16);
    ctx.globalAlpha = 1;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Where the unwarped image sits, for reference.
    const corners = [
      { x: 0, y: 0 },
      { x: size.w, y: 0 },
      { x: size.w, y: size.h },
      { x: 0, y: size.h },
    ].map(toCss);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    corners.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);

    const accent = getStageAccentHex();
    const pts = grid.map(toCss);

    // Control net, drawn over the garment.
    ctx.strokeStyle = accent;
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let r = 0; r < WARP_GRID; r++) {
      for (let c = 0; c < WARP_GRID; c++) {
        const p = pts[r * WARP_GRID + c];
        if (c === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
    }
    for (let c = 0; c < WARP_GRID; c++) {
      for (let r = 0; r < WARP_GRID; r++) {
        const p = pts[r * WARP_GRID + c];
        if (r === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
    }
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Handles.
    for (const p of pts) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, HANDLE_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = accent;
      ctx.stroke();
    }
  }, [grid, size, matrix, canvasW, canvasH, dpr, transform.opacity]);

  // Pointer position in stage px (the canvas also holds the margin).
  const toStagePoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) * canvasW) / rect.width - CANVAS_PAD,
      y: ((e.clientY - rect.top) * canvasH) / rect.height - CANVAS_PAD,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!matrix || busy) return;
    const pt = toStagePoint(e);
    let best = -1;
    let bestDist = HIT_RADIUS;
    grid.forEach((p, i) => {
      const s = applyAffine(matrix, p);
      const d = Math.hypot(s.x - pt.x, s.y - pt.y);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    if (best >= 0) {
      dragIndexRef.current = best;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Capture is only a nicety (keeps the drag alive outside the canvas).
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const index = dragIndexRef.current;
    if (index === null || !matrix) return;
    const pt = toStagePoint(e);
    // Keep the point where its handle still fits inside the canvas.
    const stagePt = clampStagePoint(pt, stageW, stageH);
    const next = applyAffine(invertAffine(matrix), stagePt);
    setGrid((prev) => prev.map((p, i) => (i === index ? next : p)));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    dragIndexRef.current = null;
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Nothing to release.
    }
  };

  const handleApply = async () => {
    const img = imgRef.current;
    if (!img || !size) return;
    setBusy(true);
    setApplyError(null);
    try {
      const bake = await bakeWarp(img, size.w, size.h, grid);
      await onApply({ grid, sourceWidth: size.w, sourceHeight: size.h, bake });
    } catch (err: unknown) {
      setApplyError(err instanceof Error ? err.message : 'Could not apply the warp.');
      setBusy(false);
    }
  };

  const ready = !!size && !!matrix;

  // Fixed light colors, not theme tokens: the stage stays dark in both site
  // themes (see index.css).
  const pill = 'absolute left-1/2 -translate-x-1/2 w-max max-w-[calc(100%-1rem)] select-none rounded-2xl border border-white/10 bg-black/60 backdrop-blur-md';
  const label = 'text-[10px] font-black uppercase tracking-widest';

  return (
    <>
      {ready && (
        <canvas
          ref={canvasRef}
          width={Math.round(canvasW * dpr)}
          height={Math.round(canvasH * dpr)}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="absolute left-0 top-0 touch-none cursor-crosshair pointer-events-auto"
          style={{ width: canvasW, height: canvasH }}
        />
      )}

      {loadError ? (
        <p className={`${label} absolute inset-x-0 top-1/2 text-center text-red-400 pointer-events-none`}>{loadError}</p>
      ) : !ready ? (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <Loader2 className="animate-spin text-white/70" size={28} />
        </div>
      ) : (
        <p className={`${pill} top-3 px-4 py-2 text-center text-white/70 pointer-events-none ${label}`}>
          Drag the points to bend the garment
          {hasCrop ? ' - applying a warp clears the crop' : ''}
        </p>
      )}

      <div className={`${pill} bottom-3 flex flex-col items-center gap-2 p-1.5 pointer-events-auto`}>
        {applyError && <p className={`${label} px-3 pt-1 text-center text-red-400`}>{applyError}</p>}
        <div className="flex items-center gap-1.5">
          <button
            onClick={onCancel}
            disabled={busy}
            className={`${label} px-4 py-2.5 rounded-xl text-white/70 hover:bg-white/10 transition-all disabled:opacity-40`}
          >
            Cancel
          </button>
          <button
            onClick={() => size && setGrid(identityGrid(size.w, size.h))}
            disabled={busy || !ready}
            className={`${label} px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all disabled:opacity-40`}
          >
            Reset Points
          </button>
          <button
            onClick={handleApply}
            disabled={busy || !ready}
            className={`${label} px-5 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-on-accent shadow-lg transition-all disabled:opacity-60 flex items-center gap-2`}
          >
            {busy && <Loader2 className="animate-spin" size={14} />}
            {busy ? 'Applying...' : 'Apply Warp'}
          </button>
        </div>
      </div>
    </>
  );
};

export default WarpPanel;
