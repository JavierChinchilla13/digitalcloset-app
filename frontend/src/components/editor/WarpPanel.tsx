import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { PersonaType, type ClothingTransform } from '../../types';
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
import { ASPECT_RATIO, toCanvasCoord, toCanvasX } from './CanvasUtils';
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
  personaType: PersonaType;
  // The garment's current placement in the studio - the panel draws the persona
  // and the garment at exactly this position/size/rotation so the warp is
  // shaped in context, the way it will sit on the persona.
  transform: ClothingTransform;
  // Applying a warp drops any crop (it was framed against the old image).
  hasCrop: boolean;
  onApply: (result: WarpApplyResult) => Promise<void>;
  onCancel: () => void;
}

const HANDLE_RADIUS = 9;
const HIT_RADIUS = 16;
// The canvas is this much bigger than the stage on every side. Points can sit
// right on the stage's edge (that's how far they can be dragged) and a canvas
// only draws inside its own bounds, so without a margin the handle circles
// were cut in half or vanished at the top/bottom/sides.
const EDGE_PAD = HANDLE_RADIUS + 8;
// Space the panel's own chrome (hint text, buttons, gaps, padding) needs, so
// the stage can take the rest of the available height.
const CHROME_HEIGHT = 170;
const MIN_STAGE_HEIGHT = 300;
const MAX_STAGE_HEIGHT = 760;

const WarpPanel: React.FC<WarpPanelProps> = ({
  sourceUrl,
  warp,
  personaType,
  transform,
  hasCrop,
  onApply,
  onCancel,
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const mannequinRef = useRef<HTMLImageElement | null>(null);
  const dragIndexRef = useRef<number | null>(null);

  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [mannequinReady, setMannequinReady] = useState(false);
  const [grid, setGrid] = useState<WarpPoint[]>(warp?.grid ?? []);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [available, setAvailable] = useState<{ w: number; h: number }>({ w: 600, h: 600 });

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

  // Persona (same base images the studio canvas uses).
  useEffect(() => {
    let cancelled = false;
    setMannequinReady(false);
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      mannequinRef.current = img;
      setMannequinReady(true);
    };
    // A missing persona image shouldn't block warping - just draw without it.
    img.onerror = () => {
      if (!cancelled) {
        mannequinRef.current = null;
        setMannequinReady(true);
      }
    };
    img.src = personaType === PersonaType.MALE ? '/personas/male-base.png' : '/personas/female-base.png';
    return () => {
      cancelled = true;
    };
  }, [personaType]);

  // Fit the stage to whatever room the panel has.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const measure = () => setAvailable({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // The stage has the same 3:4 shape as the studio canvas, so a virtual
  // coordinate lands in the same place in both.
  const stageH = Math.round(
    Math.min(
      Math.max(available.h - CHROME_HEIGHT - 2 * EDGE_PAD, MIN_STAGE_HEIGHT),
      MAX_STAGE_HEIGHT,
      Math.max((available.w - 48 - 2 * EDGE_PAD) / ASPECT_RATIO, MIN_STAGE_HEIGHT)
    )
  );
  const stageW = Math.round(stageH * ASPECT_RATIO);
  const canvasW = stageW + 2 * EDGE_PAD;
  const canvasH = stageH + 2 * EDGE_PAD;

  // Warp-space (source px) -> stage px, placing the image where the garment
  // sits in the studio: centered on its (x, y), scaled to its width/height,
  // rotated and flipped like the garment. When the item is already warped,
  // the transform describes the *baked* image, whose center sits at the
  // original's center plus the recorded shift.
  const matrix: Affine | null = useMemo(() => {
    if (!size) return null;
    const current = warp ? { w: warp.bakedWidth, h: warp.bakedHeight } : size;
    const anchor = warp
      ? { x: size.w / 2 + warp.shift.x, y: size.h / 2 + warp.shift.y }
      : { x: size.w / 2, y: size.h / 2 };

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
  }, [size, warp, transform.x, transform.y, transform.width, transform.height, transform.rotation, transform.flipX, transform.flipY, stageW, stageH]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !size || !matrix || !mannequinReady || grid.length !== WARP_GRID * WARP_GRID) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // `matrix` maps to stage coordinates; everything is drawn EDGE_PAD in from
    // the canvas's own corner. (Folded into the matrix rather than a context
    // translate because renderWarpedMesh sets each triangle's transform
    // absolutely.)
    const drawMatrix: Affine = { ...matrix, e: matrix.e + EDGE_PAD, f: matrix.f + EDGE_PAD };

    // The stage's own bounds - the area the points can be dragged within.
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.strokeRect(EDGE_PAD + 0.5, EDGE_PAD + 0.5, stageW, stageH);

    // Persona, scaled to the stage height and centered, like the studio canvas.
    const mannequin = mannequinRef.current;
    if (mannequin) {
      const k = stageH / mannequin.naturalHeight;
      const mw = mannequin.naturalWidth * k;
      ctx.drawImage(mannequin, EDGE_PAD + (stageW - mw) / 2, EDGE_PAD, mw, stageH);
    }

    // The warped garment, at the garment's own opacity.
    ctx.globalAlpha = transform.opacity ?? 1;
    renderWarpedMesh(ctx, img, size.w, size.h, grid, drawMatrix, 16);
    ctx.globalAlpha = 1;

    // Where the unwarped image sits, for reference.
    const corners = [
      { x: 0, y: 0 },
      { x: size.w, y: 0 },
      { x: size.w, y: size.h },
      { x: 0, y: size.h },
    ].map((p) => applyAffine(drawMatrix, p));
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    corners.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);

    const accent = getStageAccentHex();
    const pts = grid.map((p) => applyAffine(drawMatrix, p));

    // Control net.
    ctx.strokeStyle = accent;
    ctx.globalAlpha = 0.75;
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
      ctx.lineWidth = 2;
      ctx.strokeStyle = accent;
      ctx.stroke();
    }
  }, [grid, size, matrix, mannequinReady, stageW, stageH, transform.opacity]);

  const toStagePoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    // Stage coordinates: canvas pixels minus the margin.
    return {
      x: ((e.clientX - rect.left) * canvas.width) / rect.width - EDGE_PAD,
      y: ((e.clientY - rect.top) * canvas.height) / rect.height - EDGE_PAD,
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
    // Keep the point on the stage so its handle stays reachable.
    const stagePt = {
      x: Math.min(Math.max(pt.x, 0), stageW),
      y: Math.min(Math.max(pt.y, 0), stageH),
    };
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

  const ready = !!size && !!matrix && mannequinReady;

  return (
    <div
      ref={rootRef}
      className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-stage rounded-2xl p-6"
    >
      {loadError ? (
        <p className="text-[10px] font-black uppercase tracking-widest text-red-400">{loadError}</p>
      ) : !ready ? (
        <Loader2 className="animate-spin text-accent" size={28} />
      ) : (
        <>
          <p className="text-[10px] font-black uppercase tracking-widest text-text-secondary text-center">
            Drag the points to bend the garment on the persona
            {hasCrop ? ' - applying a warp clears the crop' : ''}
          </p>
          <canvas
            ref={canvasRef}
            width={canvasW}
            height={canvasH}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className="rounded-xl border border-ink/5 touch-none cursor-crosshair"
            style={{ width: canvasW, height: canvasH, maxWidth: '100%' }}
          />
          {applyError && (
            <p className="text-[10px] font-black uppercase tracking-widest text-red-400 text-center max-w-sm">
              {applyError}
            </p>
          )}
          <div className="flex items-center gap-3">
            <button
              onClick={onCancel}
              disabled={busy}
              className="px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-text-secondary hover:bg-ink/5 transition-all disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              onClick={() => size && setGrid(identityGrid(size.w, size.h))}
              disabled={busy}
              className="px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest bg-ink/5 hover:bg-ink/10 text-text-primary transition-all disabled:opacity-40"
            >
              Reset Points
            </button>
            <button
              onClick={handleApply}
              disabled={busy}
              className="px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest bg-accent hover:bg-accent-hover text-on-accent shadow-lg transition-all disabled:opacity-60 flex items-center gap-2"
            >
              {busy && <Loader2 className="animate-spin" size={14} />}
              {busy ? 'Applying...' : 'Apply Warp'}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default WarpPanel;
