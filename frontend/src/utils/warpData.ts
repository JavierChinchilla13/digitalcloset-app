import type { WarpPoint } from './meshWarp';

// Stored in a clothing item's `modularData` string (Task 56 prototype - avoids
// a database migration until the feature proves worth keeping). Only ever
// present on non-modular items: the jacket renderer reads `modularData` only
// when `isModular` is true, so the two uses can't collide.
//
// The item's own `imageUrl` holds the *baked* (warped) PNG, so the persona
// renderer and every thumbnail need no changes. This record keeps what's
// needed to re-edit or undo the warp.
export interface WarpData {
  version: 1;
  originalImageUrl: string;
  originalWidth: number;
  originalHeight: number;
  // Control points in the original image's pixel space (see meshWarp.ts).
  grid: WarpPoint[];
  bakedWidth: number;
  bakedHeight: number;
  // Baked image's center relative to the original's center, in original px.
  shift: WarpPoint;
}

export function parseWarpData(modularData?: string | null, isModular?: boolean): WarpData | null {
  if (isModular || !modularData) return null;
  try {
    const parsed = JSON.parse(modularData);
    if (
      parsed && parsed.version === 1 && typeof parsed.originalImageUrl === 'string' &&
      Array.isArray(parsed.grid) && parsed.grid.length === 9
    ) {
      return parsed as WarpData;
    }
  } catch {
    // Not warp data (or corrupt) - treat as no warp.
  }
  return null;
}

export function serializeWarpData(data: WarpData): string {
  return JSON.stringify(data);
}
