// Module augmentation for Fabric.js v7 (Task 25).
//
// Fabric v6 removed `name` from its object types, but the runtime still
// accepts it: FabricObject's constructor funnels options through
// CommonMethods._setOptions, which does `for (const prop in options)
// this.set(prop, options[prop])` and ultimately `this[key] = value` - so
// ANY unknown constructor option is assigned straight onto the instance.
//
// This codebase relies on that: every editor tags its objects with
// `name: 'garment' | 'mannequin' | 'cropBox' | 'torso' | ...` at construction
// and looks them up later via `canvas.getObjects().find(o => o.name === ...)`.
// That works correctly at runtime; only the types disagreed, producing 38 of
// the 142 baseline errors.
//
// Declaring the properties here restores type safety at the lookup sites
// without changing a single line of runtime behaviour.

import 'fabric';

declare module 'fabric' {
  interface FabricObject {
    // Identifier used throughout the editors to find a specific object on a
    // canvas (see ClothingCanvas, JacketCanvas, ShoeCanvas, CanvasUtils).
    name?: string;
  }

  // Fabric exports two distinct object classes: FabricObject (the interactive
  // one, used for canvas contents) and BaseFabricObject (the plain one, which
  // is what `clipPath` is typed as). CanvasUtils reads `clipPath.name` to
  // recognise a crop mask, so the base class needs the property too.
  interface BaseFabricObject {
    name?: string;
  }

  interface Canvas {
    // Pointer position stashed between mouse:down / mouse:move while panning
    // in GarmentCleanup's 'pan' tool. Fabric's own panning examples use this
    // same on-canvas-stash pattern.
    //
    // Deliberately NOT optional: both are written in the mouse:down handler
    // that sets the `isPanning` flag, and are only ever read inside an
    // `if (isPanning)` guard, so they are always defined at every read site.
    // Marking them optional would force non-null assertions at those reads
    // for a case that cannot occur.
    lastPosX: number;
    lastPosY: number;
  }
}
