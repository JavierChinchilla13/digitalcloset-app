import { ClothingCategory, PersonaStatus, PersonaType, type ClothingItem, type ClothingTransform } from '../types';

// Task 101: the starter garments a new account can add in one tap, so the first outfit does not
// need a photo shoot. The pictures are served from this site (public/samples/); their URLs are
// stored in users' garment rows, so the file names are permanent - never rename or remove one.

// The part of the picture that is not transparent, as fractions of its width / height. Measured from
// the files; it is what lets a garment be placed by where it is SEEN on the figure instead of by
// where its (differently padded) picture rectangle happens to sit.
type ContentBox = readonly [left: number, top: number, right: number, bottom: number];

// Where the garment's visible area goes on the figure, in persona canvas pixels (750 x 1000): the
// horizontal centre, the top edge, and the size (give the width or the height; the other follows).
interface Fit {
  centerX: number;
  top: number;
  width?: number;
  height?: number;
}

export interface SampleGarment {
  // Stable id of the sample (also the picture's file name).
  slug: string;
  name: string;
  category: ClothingCategory;
  imageUrl: string;
  // Picture width / height.
  aspect: number;
  content: ContentBox;
  // One fit per piece the sample creates (a pair of shoes is two pieces: left, then right).
  fit: Record<PersonaType, Fit[]>;
}

// Hand-measured against the two persona base images (shoulders at y ~195, hips ~520, ankles ~890).
export const SAMPLE_GARMENTS: SampleGarment[] = [
  {
    slug: 'black-tee', name: 'Black Tee', category: ClothingCategory.TOP, imageUrl: '/samples/black-tee.png',
    aspect: 1.0, content: [0.128, 0.146, 0.866, 0.844],
    fit: { [PersonaType.MALE]: [{ centerX: 371, top: 168, width: 305 }], [PersonaType.FEMALE]: [{ centerX: 373, top: 162, width: 290 }] },
  },
  {
    slug: 'purple-tee', name: 'Purple Tee', category: ClothingCategory.TOP, imageUrl: '/samples/purple-tee.png',
    aspect: 0.72, content: [0.08, 0.158, 0.915, 0.837],
    fit: { [PersonaType.MALE]: [{ centerX: 371, top: 168, width: 295 }], [PersonaType.FEMALE]: [{ centerX: 373, top: 162, width: 280 }] },
  },
  {
    slug: 'pants', name: 'Pants', category: ClothingCategory.BOTTOM, imageUrl: '/samples/pants.png',
    aspect: 0.84, content: [0.249, 0.09, 0.697, 0.96],
    fit: { [PersonaType.MALE]: [{ centerX: 371, top: 440, height: 450 }], [PersonaType.FEMALE]: [{ centerX: 372, top: 430, height: 450 }] },
  },
  {
    slug: 'shorts', name: 'Shorts', category: ClothingCategory.BOTTOM, imageUrl: '/samples/shorts.png',
    aspect: 0.8, content: [0.121, 0.206, 0.879, 0.794],
    fit: { [PersonaType.MALE]: [{ centerX: 371, top: 440, width: 230 }], [PersonaType.FEMALE]: [{ centerX: 372, top: 445, width: 215 }] },
  },
  {
    slug: 'black-jacket', name: 'Black Jacket', category: ClothingCategory.JACKET, imageUrl: '/samples/black-jacket.png',
    aspect: 0.86, content: [0.002, 0.002, 0.998, 0.998],
    fit: { [PersonaType.MALE]: [{ centerX: 371, top: 185, width: 340 }], [PersonaType.FEMALE]: [{ centerX: 373, top: 185, width: 300 }] },
  },
  {
    slug: 'denim-jacket', name: 'Denim Jacket', category: ClothingCategory.JACKET, imageUrl: '/samples/denim-jacket.png',
    aspect: 0.83, content: [0, 0, 0.998, 0.996],
    fit: { [PersonaType.MALE]: [{ centerX: 371, top: 185, width: 330 }], [PersonaType.FEMALE]: [{ centerX: 373, top: 185, width: 295 }] },
  },
  {
    // One front-facing boot picture, used for both feet: two pieces (left and right).
    slug: 'black-boot', name: 'Black Boots', category: ClothingCategory.SHOES, imageUrl: '/samples/black-boot.png',
    aspect: 0.55, content: [0.048, 0.03, 0.938, 0.97],
    fit: {
      [PersonaType.MALE]: [{ centerX: 312, top: 842, height: 172 }, { centerX: 422, top: 842, height: 172 }],
      [PersonaType.FEMALE]: [{ centerX: 338, top: 875, height: 120 }, { centerX: 406, top: 875, height: 120 }],
    },
  },
];

// The pieces added by "Add a starter outfit": one top, one bottom, one pair of shoes.
export const STARTER_OUTFIT_SLUGS = ['black-tee', 'pants', 'black-boot'];

// How many closet slots a sample uses (a pair of shoes is 2).
export function sampleSlots(sample: SampleGarment): number {
  return sample.fit[PersonaType.MALE].length;
}

// The transform that puts the sample's visible area on its target box, keeping the picture's own
// proportions (the persona layer stretches the picture to width x height, so nothing is distorted).
export function sampleTransform(sample: SampleGarment, persona: PersonaType, piece = 0): ClothingTransform {
  const fit = sample.fit[persona][piece];
  const [left, top, right, bottom] = sample.content;
  const contentW = right - left;
  const contentH = bottom - top;
  const height = fit.height !== undefined ? fit.height / contentH : fit.width! / contentW / sample.aspect;
  const width = height * sample.aspect;
  // The picture's centre, so that the visible area's centre lands on centerX and its top on `top`.
  const x = fit.centerX - ((left + right) / 2 - 0.5) * width;
  const y = fit.top - top * height + height / 2;
  return { x: Math.round(x), y: Math.round(y), scaleX: 1, scaleY: 1, rotation: 0, width: Math.round(width), height: Math.round(height) };
}

// The payloads to create the garment(s) for the given persona (the same shape the upload flow saves).
// A pair of shoes is a left and a right piece, the right one mirrored.
export function sampleToNewItems(sample: SampleGarment, persona: PersonaType): Omit<ClothingItem, 'itemId'>[] {
  const pieces = sample.fit[persona].length;
  return Array.from({ length: pieces }, (_, piece) => {
    const isPair = pieces === 2;
    const transform = sampleTransform(sample, persona, piece);
    return {
      name: sample.name,
      category: sample.category,
      imageUrl: sample.imageUrl,
      personaType: persona,
      personaStatus: PersonaStatus.FITTED,
      transform: isPair && piece === 1 ? { ...transform, flipX: true } : transform,
      ...(isPair ? { side: piece === 0 ? ('left' as const) : ('right' as const) } : {}),
    };
  });
}
