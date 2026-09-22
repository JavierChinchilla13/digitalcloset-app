// Task 72, Phase 9.6: the VYSVI wordmark.
//
// The real logo is a silver "V" ribbon mark with a "VYSVI / DIGITAL
// WARDROBE" lockup underneath (see the user's frontend/public/logo.png) -
// but that file has a solid light background baked in, so it can't be
// dropped straight into a dark navbar. The plan's own resolution for this
// (open dependency, see PROJECT_BLUEPRINT.md's Phase 9.6 section) was: a
// text wordmark now, swapped for the real image once transparent PNG/SVG
// files (plus a dark-ink variant for light mode) are available.
//
// `theme-aware` here means the *text* readiness for that swap - when the
// image files land, this component is where <img> tags keyed off
// data-theme replace the text below, not a new component.
import { cn } from '../utils/cn';

interface BrandMarkProps {
  className?: string;
  // The navbar wants a compact single-line mark; a future full lockup
  // (e.g. a signup-page header) can ask for the two-line version with the
  // "DIGITAL WARDROBE" subline, matching the real logo's layout.
  withSubline?: boolean;
}

const BrandMark = ({ className, withSubline = false }: BrandMarkProps) => {
  return (
    <span className={cn('inline-flex flex-col leading-none', className)}>
      <span className="font-display text-xl tracking-[0.3em] text-text-primary">
        VYSVI
      </span>
      {withSubline && (
        <span className="mt-1 text-[9px] font-medium tracking-[0.4em] text-text-secondary uppercase">
          Digital Wardrobe
        </span>
      )}
    </span>
  );
};

export default BrandMark;
