import React from 'react';
import type { ClothingTransform } from '../types';
import { getCropDisplay } from '../utils/cropDisplay';

interface CroppedThumbnailProps {
  imageUrl: string;
  transform?: ClothingTransform;
  alt: string;
  className?: string;
  // The object-fit the call site would otherwise have used - 'cover' (the
  // common case) fills/crops the box to its aspect, 'contain' letterboxes
  // the whole image. Only used for uncropped items; a cropped item is always
  // shown contained (see below).
  fit?: 'cover' | 'contain';
}

// Fraction of the card the cropped picture may occupy on each axis - leaves
// the same breathing room around a cropped garment as the other garments
// have around their (transparent-margin) cutouts.
const CROP_FILL = 0.9;

// Drop-in replacement for `<img src={item.imageUrl} className="... object-cover">`
// wherever a clothing item's flat browse/card thumbnail is shown - a plain
// `<img>` always shows the full original photo, ignoring any crop applied in
// Fabric Studio. Renders background-image divs instead of an `<img>` since
// object-fit/object-position can't target an arbitrary sub-region of an
// image, but background-size/position can.
//
// A cropped item is drawn into an inner box with exactly the crop's own
// aspect ratio, sized to fit *within* the card and centered (container-query
// units let it "contain" itself without knowing the card's size in JS) - so
// it reads like every other garment in the grid: centered, padded, and
// undistorted, instead of being stretched/zoomed to fill the whole card.
const CroppedThumbnail: React.FC<CroppedThumbnailProps> = ({ imageUrl, transform, alt, className, fit = 'cover' }) => {
  const crop = getCropDisplay(transform);

  if (!crop) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={className}
        style={{
          backgroundImage: `url(${imageUrl})`,
          backgroundSize: fit,
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
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
          backgroundImage: `url(${imageUrl})`,
          backgroundSize: crop.backgroundSize,
          backgroundPosition: crop.backgroundPosition,
          backgroundRepeat: 'no-repeat',
        }}
      />
    </div>
  );
};

export default CroppedThumbnail;
