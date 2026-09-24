import type { ClothingTransform } from '../types';

// Mesh warp (Task 56 prototype). A 3x3 grid of control points, in the SOURCE
// image's pixel space, defines a smooth surface (biquadratic Lagrange through
// the 9 points) that the image is drawn onto as textured triangles. Points at
// their default positions are the identity; dragging them bends the garment.
// The result is baked into a plain PNG (see bakeWarp) so the CSS-based persona
// renderer never needs to know a warp exists.

export interface WarpPoint {
  x: number;
  y: number;
}

// Row-major: index = row * 3 + col.
export const WARP_GRID = 3;

export function identityGrid(width: number, height: number): WarpPoint[] {
  const pts: WarpPoint[] = [];
  for (let r = 0; r < WARP_GRID; r++) {
    for (let c = 0; c < WARP_GRID; c++) {
      pts.push({ x: (c * width) / (WARP_GRID - 1), y: (r * height) / (WARP_GRID - 1) });
    }
  }
  return pts;
}

// Quadratic Lagrange basis for nodes at t = 0, 0.5, 1.
function basis(t: number): [number, number, number] {
  return [2 * (t - 0.5) * (t - 1), -4 * t * (t - 1), 2 * t * (t - 0.5)];
}

// Point on the warped surface for normalized image coordinates u (across) and
// v (down), both 0..1.
export function surfacePoint(grid: WarpPoint[], u: number, v: number): WarpPoint {
  const bu = basis(u);
  const bv = basis(v);
  let x = 0;
  let y = 0;
  for (let r = 0; r < WARP_GRID; r++) {
    for (let c = 0; c < WARP_GRID; c++) {
      const w = bv[r] * bu[c];
      const p = grid[r * WARP_GRID + c];
      x += w * p.x;
      y += w * p.y;
    }
  }
  return { x, y };
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function meshBounds(grid: WarpPoint[], samples = 32): Bounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let j = 0; j <= samples; j++) {
    for (let i = 0; i <= samples; i++) {
      const p = surfacePoint(grid, i / samples, j / samples);
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
  }
  return { minX, minY, maxX, maxY };
}

// Draws one source triangle onto the destination canvas through the affine
// transform that maps it onto its destination triangle.
function drawTriangle(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  s: [WarpPoint, WarpPoint, WarpPoint],
  d: [WarpPoint, WarpPoint, WarpPoint]
) {
  const det =
    s[0].x * (s[1].y - s[2].y) + s[1].x * (s[2].y - s[0].y) + s[2].x * (s[0].y - s[1].y);
  if (Math.abs(det) < 1e-9) return;

  const a = (d[0].x * (s[1].y - s[2].y) + d[1].x * (s[2].y - s[0].y) + d[2].x * (s[0].y - s[1].y)) / det;
  const c = (s[0].x * (d[1].x - d[2].x) + s[1].x * (d[2].x - d[0].x) + s[2].x * (d[0].x - d[1].x)) / det;
  const e =
    (s[0].x * (s[1].y * d[2].x - s[2].y * d[1].x) +
      s[1].x * (s[2].y * d[0].x - s[0].y * d[2].x) +
      s[2].x * (s[0].y * d[1].x - s[1].y * d[0].x)) / det;
  const b = (d[0].y * (s[1].y - s[2].y) + d[1].y * (s[2].y - s[0].y) + d[2].y * (s[0].y - s[1].y)) / det;
  const dd = (s[0].x * (d[1].y - d[2].y) + s[1].x * (d[2].y - d[0].y) + s[2].x * (d[0].y - d[1].y)) / det;
  const f =
    (s[0].x * (s[1].y * d[2].y - s[2].y * d[1].y) +
      s[1].x * (s[2].y * d[0].y - s[0].y * d[2].y) +
      s[2].x * (s[0].y * d[1].y - s[1].y * d[0].y)) / det;

  // Grow the clip triangle outward from its centroid so adjacent triangles
  // overlap instead of leaving hairline seams (two anti-aliased edges that
  // merely touch composite to ~75% alpha, not 100%). Growing each vertex by
  // GROW px moves the edges out by roughly half that for these small,
  // near-right triangles, so this needs to be ~2px to overlap by ~1px; the
  // overshoot is drawn with the neighbor's own (continuous) texture mapping,
  // so it's invisible where triangles meet.
  const GROW = 2;
  const cx = (d[0].x + d[1].x + d[2].x) / 3;
  const cy = (d[0].y + d[1].y + d[2].y) / 3;
  const grown = d.map((p) => {
    const dx = p.x - cx;
    const dy = p.y - cy;
    const len = Math.hypot(dx, dy) || 1;
    return { x: p.x + (dx / len) * GROW, y: p.y + (dy / len) * GROW };
  });

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(grown[0].x, grown[0].y);
  ctx.lineTo(grown[1].x, grown[1].y);
  ctx.lineTo(grown[2].x, grown[2].y);
  ctx.closePath();
  ctx.clip();
  ctx.setTransform(a, b, c, dd, e, f);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}

// 2x3 affine matrix mapping warp-space points (source-image pixels, i.e. the
// space the control points live in) to destination canvas pixels:
// x' = a*x + c*y + e, y' = b*x + d*y + f.
export interface Affine {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

export const IDENTITY_AFFINE: Affine = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

export function applyAffine(m: Affine, p: WarpPoint): WarpPoint {
  return { x: m.a * p.x + m.c * p.y + m.e, y: m.b * p.x + m.d * p.y + m.f };
}

export function invertAffine(m: Affine): Affine {
  const det = m.a * m.d - m.b * m.c;
  const a = m.d / det;
  const b = -m.b / det;
  const c = -m.c / det;
  const d = m.a / det;
  return { a, b, c, d, e: -(a * m.e + c * m.f), f: -(b * m.e + d * m.f) };
}

// Renders the warped image into `ctx`. The caller clears the canvas first.
export function renderWarpedMesh(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  srcWidth: number,
  srcHeight: number,
  grid: WarpPoint[],
  matrix: Affine,
  subdivisions = 20
) {
  const toDest = (p: WarpPoint): WarpPoint => applyAffine(matrix, p);

  const vertex = (i: number, j: number) => {
    const u = i / subdivisions;
    const v = j / subdivisions;
    return {
      src: { x: u * srcWidth, y: v * srcHeight },
      dest: toDest(surfacePoint(grid, u, v)),
    };
  };

  // ctx.save/restore inside drawTriangle restore the transform for us, but a
  // caller-set transform would be overwritten by setTransform - the callers
  // here always draw with an identity base transform.
  for (let j = 0; j < subdivisions; j++) {
    for (let i = 0; i < subdivisions; i++) {
      const p00 = vertex(i, j);
      const p10 = vertex(i + 1, j);
      const p01 = vertex(i, j + 1);
      const p11 = vertex(i + 1, j + 1);
      drawTriangle(ctx, img, [p00.src, p10.src, p01.src], [p00.dest, p10.dest, p01.dest]);
      drawTriangle(ctx, img, [p10.src, p11.src, p01.src], [p10.dest, p11.dest, p01.dest]);
    }
  }
}

export interface BakeResult {
  blob: Blob;
  width: number;
  height: number;
  // Warped surface's bounding-box center relative to the source image's
  // center, in source pixels (x right, y down).
  shift: WarpPoint;
}

const MAX_BAKE_SIZE = 6000;

// Bakes the warp into a new PNG at 1 source pixel = 1 output pixel, sized to
// the warped surface's bounding box.
export async function bakeWarp(
  img: CanvasImageSource,
  srcWidth: number,
  srcHeight: number,
  grid: WarpPoint[]
): Promise<BakeResult> {
  const b = meshBounds(grid);
  const width = Math.ceil(b.maxX - b.minX);
  const height = Math.ceil(b.maxY - b.minY);
  if (width < 4 || height < 4 || width > MAX_BAKE_SIZE || height > MAX_BAKE_SIZE) {
    throw new Error('The warp is too extreme - move the points back toward the image.');
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available in this browser.');

  renderWarpedMesh(ctx, img, srcWidth, srcHeight, grid, { ...IDENTITY_AFFINE, e: -b.minX, f: -b.minY }, 32);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Could not export the warped image (the source image may block canvas access).');

  return {
    blob,
    width,
    height,
    shift: { x: (b.minX + b.maxX) / 2 - srcWidth / 2, y: (b.minY + b.maxY) / 2 - srcHeight / 2 },
  };
}

// The garment's virtual width/height are the *displayed* size of its image, so
// when the image's pixel size changes (warp applied, re-warped, or restored)
// the virtual size must scale by the same ratio to keep the garment looking the
// same size, and its center must move by however far the image's center moved
// (rotated into the garment's own frame) so it doesn't visibly jump. The crop
// mask is dropped - it was expressed against the old image's framing.
export function retargetTransform(
  transform: ClothingTransform,
  oldPx: { width: number; height: number },
  newPx: { width: number; height: number },
  centerShiftPx: WarpPoint
): ClothingTransform {
  const width = transform.width || 450;
  const height = transform.height || (width * oldPx.height) / oldPx.width;
  const kx = width / oldPx.width;
  const ky = height / oldPx.height;

  const dx = centerShiftPx.x * kx;
  const dy = centerShiftPx.y * ky;
  const rad = ((transform.rotation || 0) * Math.PI) / 180;

  return {
    ...transform,
    width: newPx.width * kx,
    height: newPx.height * ky,
    x: transform.x + dx * Math.cos(rad) - dy * Math.sin(rad),
    y: transform.y + dx * Math.sin(rad) + dy * Math.cos(rad),
    maskLeft: undefined,
    maskTop: undefined,
    maskWidth: undefined,
    maskHeight: undefined,
  };
}
