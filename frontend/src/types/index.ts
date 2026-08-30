export enum Role {
  ROLE_USER = 'ROLE_USER',
  ROLE_ADMIN = 'ROLE_ADMIN'
}

export enum PersonaType {
  MALE = 'MALE',
  FEMALE = 'FEMALE'
}

export interface PersonaState {
  type: PersonaType;
  topIds: number[];
  bottomIds: number[];
  leftShoeId: number | null;
  rightShoeId: number | null;
  accessoryIds: number[];
  jacketIds: number[];
  dressIds: number[];
}

export interface User {
  userId: number;
  email: string;
  firstName?: string;
  lastName?: string;
  role: Role;
  active: boolean;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  userId: number;
  email: string;
  role: Role;
}

export enum ClothingCategory {
  TOP = 'TOP',
  BOTTOM = 'BOTTOM',
  SHOES = 'SHOES',
  ACCESSORY = 'ACCESSORY',
  JACKET = 'JACKET',
  DRESS = 'DRESS'
}

export interface ClothingTransform {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  width?: number;
  height?: number;
  opacity?: number;
  flipX?: boolean;
  flipY?: boolean;
  zIndex?: number;
  maskTop?: number;
  maskLeft?: number;
  maskWidth?: number;
  maskHeight?: number;
  openness?: number; // 0 to 1, jacket center-opening width (modular jackets only)
}

export interface ClothingItem {
  itemId: number;
  name: string;
  description?: string;
  category: ClothingCategory;
  imageUrl: string;
  personaType: PersonaType;
  transform: ClothingTransform;
  side?: 'left' | 'right';
  isModular?: boolean;
  modularData?: string; // JSON string
  active?: boolean;
  uploadDate?: string;
  isFavorite?: boolean;
}

export interface ModularJacketData {
  segments: {
    torso?: { imageUrl: string; transform: ClothingTransform };
    leftSleeve?: { imageUrl: string; transform: ClothingTransform };
    rightSleeve?: { imageUrl: string; transform: ClothingTransform };
    collar?: { imageUrl: string; transform: ClothingTransform };
  };
  isOpen?: boolean;
  openness?: number; // 0 to 1, width of center opening
  renderOrder?: string[];
}

// Simplified outfit contract (Task 15) - matches the backend's
// OutfitItemResponse. The per-item transform columns still exist in the
// database as nullable future capability, but aren't part of this contract.
export interface OutfitItem {
  outfitItemId: number;
  itemId: number;
  itemName?: string;
  imageUrl?: string;
  slot?: string;
  itemOrder?: number;
}

export interface ShoePair {
  leftShoe: {
    imageUrl: string;
    transform: ClothingTransform;
  };
  rightShoe: {
    imageUrl: string;
    transform: ClothingTransform;
  };
  mirrored: boolean;
  category: ClothingCategory;
  personaType: PersonaType;
}

export interface Outfit {
  outfitId: number;
  name: string;
  description?: string;
  avatarType: PersonaType;
  items: OutfitItem[];
  createdAt: string;
}

// Simplified outfit contract (Task 15) - matches the backend's OutfitRequest.
export interface OutfitRequest {
  name: string;
  description?: string;
  avatarType: PersonaType;
  items: {
    itemId: number;
    slot?: string;
    itemOrder?: number;
  }[];
}
