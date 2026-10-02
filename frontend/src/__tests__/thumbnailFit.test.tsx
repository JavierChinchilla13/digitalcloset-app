import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import CroppedThumbnail from '../components/CroppedThumbnail';
import { getVisibleDisplay } from '../utils/cropDisplay';
import { useVisibleBounds, type VisibleBounds } from '../hooks/useVisibleBounds';

// Task 87: garment thumbnails fit the whole garment inside their card with the
// same padding, using the part of the picture that is actually visible - so a
// picture with big transparent margins, a tightly trimmed one and a tall one all
// fill their card alike (before, uncropped garments were cover-zoomed and clipped).
vi.mock('../hooks/useVisibleBounds', () => ({ useVisibleBounds: vi.fn() }));
const bounds = vi.mocked(useVisibleBounds);

describe('getVisibleDisplay', () => {
  it('shows only the visible region: its own aspect ratio, scaled up to fill the box', () => {
    // A 1000 x 500 picture whose garment sits in the middle half: x 25%..75%, y 10%..90%.
    const display = getVisibleDisplay({ left: 0.25, top: 0.1, width: 0.5, height: 0.8 }, 1000, 500)!;
    // Region = 500 x 400 px -> 1.25.
    expect(display.aspectRatio).toBeCloseTo(1.25);
    expect(display.backgroundSize).toBe('200% 125%');
    // left 0.25 of the 0.5 overflow -> 50%, top 0.1 of the 0.2 overflow -> 50%.
    const [posX, posY] = display.backgroundPosition.split(' ').map(parseFloat);
    expect(posX).toBeCloseTo(50);
    expect(posY).toBeCloseTo(50);
  });

  it('a garment that fills its picture is just contained whole', () => {
    const display = getVisibleDisplay({ left: 0, top: 0, width: 1, height: 1 }, 600, 800)!;
    expect(display.aspectRatio).toBeCloseTo(0.75);
    expect(display.backgroundSize).toBe('100% 100%');
    expect(display.backgroundPosition).toBe('0% 0%');
  });

  it('is null for an unusable picture or region', () => {
    expect(getVisibleDisplay({ left: 0, top: 0, width: 0, height: 1 }, 100, 100)).toBeNull();
    expect(getVisibleDisplay({ left: 0, top: 0, width: 1, height: 1 }, 0, 100)).toBeNull();
  });
});

describe('CroppedThumbnail', () => {
  beforeEach(() => bounds.mockReset());

  it('before the visible bounds are known it contains the whole picture with padding (never cover)', () => {
    bounds.mockReturnValue(null);
    render(<CroppedThumbnail imageUrl="/g/shoe.png" alt="shoe" className="w-full h-full" />);

    const el = screen.getByRole('img', { name: 'shoe' });
    expect(el.style.backgroundSize).toBe('contain');
    expect(el.style.padding).toBe('5%');
    expect(el.style.backgroundImage).toContain('/g/shoe.png');
  });

  it('with the bounds it fits the visible part into a box of its own shape, 90% of the card', () => {
    const measured: VisibleBounds = { region: { left: 0.2, top: 0.1, width: 0.6, height: 0.8 }, width: 800, height: 1000 };
    bounds.mockReturnValue(measured);
    render(<CroppedThumbnail imageUrl="/g/jacket.png" alt="jacket" className="w-full h-full" />);

    const el = screen.getByRole('img', { name: 'jacket' });
    // Region 480 x 800 px = 0.6.
    // (jsdom may serialise it as "0.6 / 1".)
    expect(parseFloat(el.style.aspectRatio)).toBeCloseTo(0.6);
    // (The 90% box width uses container-query units, which jsdom drops - checked live.)
    expect(el.style.backgroundSize).toContain('166.666');
  });

  it("a garment with a Fabric crop keeps its crop (the measured bounds don't override it)", () => {
    bounds.mockReturnValue({ region: { left: 0, top: 0, width: 0.5, height: 0.5 }, width: 100, height: 100 });
    render(
      <CroppedThumbnail
        imageUrl="/g/tee.png"
        alt="tee"
        className="w-full h-full"
        transform={{ x: 375, y: 500, width: 400, height: 400, rotation: 0, scaleX: 1, scaleY: 1, maskLeft: 475, maskTop: 500, maskWidth: 200, maskHeight: 400 }}
      />
    );
    // The crop is the right half of the picture: 200 x 400 -> aspect 0.5.
    expect(parseFloat(screen.getByRole('img', { name: 'tee' }).style.aspectRatio)).toBeCloseTo(0.5);
  });

  it("'cover' still means the old zoom-to-fill", () => {
    bounds.mockReturnValue({ region: { left: 0.2, top: 0.2, width: 0.6, height: 0.6 }, width: 100, height: 100 });
    render(<CroppedThumbnail imageUrl="/g/hero.png" alt="hero" className="w-full h-full" fit="cover" />);
    const el = screen.getByRole('img', { name: 'hero' });
    expect(el.style.backgroundSize).toBe('cover');
    expect(el.style.padding).toBe('');
  });
});
