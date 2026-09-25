import { ClothingCategory, PersonaStatus, PersonaType } from '../types';
import type { ClothingItem } from '../types';

// Task 23: small builders so each test states only what it cares about.
export function makeItem(overrides: Partial<ClothingItem> = {}): ClothingItem {
  return {
    itemId: 1,
    name: 'White Shirt',
    category: ClothingCategory.TOP,
    imageUrl: 'https://res.cloudinary.com/test/image/upload/white-shirt.png',
    personaType: PersonaType.FEMALE,
    personaStatus: PersonaStatus.FITTED,
    transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
    ...overrides,
  };
}
