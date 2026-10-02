import React from 'react';
import type { ClothingTransform } from '../types';
import { getCropDisplay, getVisibleDisplay } from '../utils/cropDisplay';
import { useVisibleBounds } from '../hooks/useVisibleBounds';

interface CroppedThumbnailProps {
  imageUrl: string;
  transform?: ClothingTransform;
  alt: string;
  className?: string;
  // Task 87: garments are fitted whole inside their card by default
  // ('contain'), using the part of the picture that is actually visible, so
  // every garment fills its card the same way. 'cover' is the old behavior
  // (zoom the picture to fill and clip the overflow) for a call site that
  // really wants a full-bleed picture.
  fit?: 'cover' | 'contain';
}

// Fraction of the card the garment may occupy on each axis - the same breathing
// room for every garment, cropped or not.
const CROP_FILL = 0.9;

// Drop-in replacement for `<img src={item.imageUrl} className="... object-cover">`
// wherever a clothing item's flat browse/card thumbnail is shown - a plain
// `<img>` always shows the full original photo, ignoring any crop applied in
// Fabric Studio. Renders background-image divs instead of an `<img>` since
// object-fit/object-position can't target an arbitrary sub-region of an
// image, but background-size/position can. (So an `object-cover` class on a
// call site does nothing - sizing comes from this component.)
//
// The garment is drawn into an inner box with exactly the aspect ratio of what
// should be shown, sized to fit *within* the card and centered (container-query
// units let it "contain" itself without knowing the card's size in JS):
//  - a cropped item shows its Fabric crop;
//  - any other item shows the visible part of its picture (Task 87: measured
//    once per picture, see useVisibleBounds) - so transparent margins don't
//    shrink a garment and a full-bleed cutout doesn't overflow its card;
//  - until that is measured, or if it can't be, the whole picture is contained
//    with the same padding.
const CroppedThumbnail: React.FC<CroppedThumbnailProps> = ({ imageUrl, transform, alt, className, fit = 'contain' }) => {
  const bounds = useVisibleBounds(imageUrl);
  const crop =
    getCropDisplay(transform) ??
    (fit === 'contain' && bounds ? getVisibleDisplay(bounds.region, bounds.width, bounds.height) : null);

  if (!crop) {
    const cover = fit === 'cover';
    return (
      <div
        role="img"
        aria-label={alt}
        className={className}
        style={{
          // Quoted: an unquoted CSS url() breaks on a raw space (or other
          // CSS-significant character) in the path - real for local /public
          // assets with spaces in their filename (Task 81's demo garments),
          // silently rendering nothing rather than erroring.
          backgroundImage: `url("${imageUrl}")`,
          backgroundSize: cover ? 'cover' : 'contain',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          // The whole-picture fallback keeps the same padding as a fitted
          // garment (the picture is drawn in the content box, inset 5%).
          ...(cover
            ? {}
            : { boxSizing: 'border-box' as const, padding: `${Math.round((1 - CROP_FILL) * 50 * 100) / 100}%`, backgroundOrigin: 'content-box' as const, backgroundClip: 'content-box' as const }),
        }}
      />
    );
  }

  const pct = CROP_FILL * 100;
  return (
    <div
      className={className}
      style={{
        containerType: 'size',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        role="img"
        aria-label={alt}
        style={{
          aspectRatio: crop.aspectRatio,
          width: `min(${pct}cqw, calc(${pct}cqh * ${crop.aspectRatio}))`,
          backgroundImage: `url("${imageUrl}")`,
          backgroundSize: crop.backgroundSize,
          backgroundPosition: crop.backgroundPosition,
          backgroundRepeat: 'no-repeat',
        }}
      />
    </div>
  );
};

export default CroppedThumbnail;
