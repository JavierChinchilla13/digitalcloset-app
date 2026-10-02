import { create } from 'zustand';
import { ClothingCategory, PersonaStatus, PersonaType } from '../types';
import type { ClothingItem } from '../types';

// Task 81: the Demo page's preset closet. Deliberately a plain in-memory
// store (no `persist` middleware) - these items exist only for the current
// tab session and are never sent to the backend. Negative itemIds keep them
// unambiguously distinct from any real backend item (which only ever hands
// out positive ids).
//
// Image paths point at frontend/public/marketing/garments/ - the project
// owner's own background-removed product photos. The demo has no persona
// (it was removed - jackets never fit convincingly), so items carry only a
// placeholder transform to satisfy the ClothingItem type; nothing here is
// positioned on a body.
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
  demoItem(-1, 'Black Tee', ClothingCategory.TOP, 'Black Shirt.png'),
  demoItem(-2, 'Graphic Tee', ClothingCategory.TOP, 'Top.png'),
  demoItem(-3, 'Bomber Jacket', ClothingCategory.JACKET, 'Black jacket.png'),
  demoItem(-4, 'Denim Jacket', ClothingCategory.JACKET, 'denim jacket.png'),
  demoItem(-5, 'Chino Trousers', ClothingCategory.BOTTOM, 'Pants.png'),
  demoItem(-6, 'Sweat Shorts', ClothingCategory.BOTTOM, 'shorts.png'),
  demoItem(-7, 'University Blue Sneaker', ClothingCategory.SHOES, 'UNC 1.png'),
  demoItem(-8, 'Black Chukka Boot', ClothingCategory.SHOES, 'black shoe.png'),
];

interface DemoStore {
  items: ClothingItem[];
}

export const useDemoStore = create<DemoStore>(() => ({
  items: DEMO_ITEMS,
}));
