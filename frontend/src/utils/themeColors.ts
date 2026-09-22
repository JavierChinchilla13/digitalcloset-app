// Task 71, Phase 9.6: color helpers for the Fabric.js editing canvases
// (ClothingCanvas, JacketCanvas, ShoeCanvas, GarmentCleanup). Fabric draws
// straight onto the <canvas> element, not the DOM, so its own colors
// (selection border/corners, foot-indicator boxes, the decorative dot
// grid) can't be styled with Tailwind classes the way the rest of the app
// was migrated in Tasks 67-70 - they need an actual color string at the
// point Fabric draws.
//
// These read --vy-stage-accent (index.css) instead of the old hard-coded
// #5B8CFF (the app's pre-redesign blue accent, now stale). That variable
// is deliberately theme-independent (defined once at :root, not inside
// the light/dark blocks) because the editing stage itself stays a dark
// backdrop in both site themes - see index.css's own comment for why.
//
// Values are read once per call, not kept live: a canvas that customizes
// its controls in a mount effect won't redraw them if the user flips the
// site theme while that editor is already open - it catches up next time
// the effect re-runs (e.g. reopening the modal). Making it fully live
// would mean every canvas subscribes to theme changes and redraws its
// selection chrome, which is out of scope for this color pass.
const FALLBACK_STAGE_ACCENT = '#C7CBD1';

export function getStageAccentHex(): string {
  if (typeof window === 'undefined') return FALLBACK_STAGE_ACCENT;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue('--vy-stage-accent')
    .trim();
  return value || FALLBACK_STAGE_ACCENT;
}

// Fabric properties like `fill` need an rgba() string for translucency,
// not a hex + separate opacity - this converts the stage accent to one.
export function getStageAccentRgba(alpha: number): string {
  const hex = getStageAccentHex();
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!match) return `rgba(199, 203, 209, ${alpha})`;
  const [, r, g, b] = match;
  return `rgba(${parseInt(r, 16)}, ${parseInt(g, 16)}, ${parseInt(b, 16)}, ${alpha})`;
}
