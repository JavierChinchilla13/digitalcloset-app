import { ClothingCategory, PersonaStatus, PersonaType, Plan, Role } from '../types';
import type { ClothingItem, User } from '../types';

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

// Task 96: an account as the server sends it. Defaults to a free user (limit 15); pass
// `{ role: Role.ROLE_ADMIN, garmentLimit: null }` for an admin or `{ plan: Plan.PREMIUM, garmentLimit: 300 }`.
export function makeUser(overrides: Partial<User> = {}): User {
  return {
    userId: 1,
    email: 'shopper@example.com',
    role: Role.ROLE_USER,
    active: true,
    createdAt: '2026-01-01T00:00:00',
    plan: Plan.FREE,
    garmentLimit: 15,
    ...overrides,
  };
}

// `count` distinct garments, for filling a closet in the store.
export function makeItems(count: number): ClothingItem[] {
  return Array.from({ length: count }, (_, i) => makeItem({ itemId: i + 1, name: `Garment ${i + 1}` }));
}
