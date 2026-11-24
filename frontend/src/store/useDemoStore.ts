import { create } from 'zustand';
import { ClothingCategory, PersonaStatus, PersonaType } from '../types';
import type { ClothingItem } from '../types';

// Task 81: the Demo page's preset closet. Deliberately a plain in-memory
// store (no `persist` middleware) - these items exist only for the current
// tab session and are never sent to the backend. Negative itemIds keep them
// unambiguously distinct from any real backend item (which only ever hands
// out positive ids).
//
// Image paths point at frontend/public/marketing/garments/ - illustrative renders with no brands (not
// photos of real clothes). The demo has no persona (it was removed - jackets never fit convincingly), so
// items carry only a placeholder transform to satisfy the ClothingItem type; nothing here is positioned on a body.
const GARMENT = '/marketing/garments';
const PLACEHOLDER_TRANSFORM = { x: 375, y: 500, scaleX: 1, scaleY: 1, rotation: 0 };

function demoItem(itemId: number, name: string, category: ClothingCategory, file: string): ClothingItem {
  return {
    itemId,
    name,
    category,
    imageUrl: `${GARMENT}/${file}`,
    personaType: PersonaType.MALE,
    personaStatus: PersonaStatus.FITTED,
    transform: PLACEHOLDER_TRANSFORM,
  };
}

const DEMO_ITEMS: ClothingItem[] = [
  demoItem(-1, 'White Shirt', ClothingCategory.TOP, 'shirt-white.png'),
  demoItem(-2, 'Navy Shirt', ClothingCategory.TOP, 'shirt-navy.png'),
  demoItem(-3, 'Black Puffer Jacket', ClothingCategory.JACKET, 'puffer-jacket-black.png'),
  demoItem(-4, 'Black Hoodie', ClothingCategory.JACKET, 'hoodie-black.png'),
  demoItem(-5, 'Blue Jeans', ClothingCategory.BOTTOM, 'jeans-blue.png'),
  demoItem(-6, 'Beige Chinos', ClothingCategory.BOTTOM, 'chinos-beige.png'),
  demoItem(-7, 'White Sneakers', ClothingCategory.SHOES, 'sneakers-white.png'),
  demoItem(-8, 'Black & White Sneakers', ClothingCategory.SHOES, 'sneakers-black-white.png'),
];

interface DemoStore {
  items: ClothingItem[];
}

export const useDemoStore = create<DemoStore>(() => ({
  items: DEMO_ITEMS,
}));
