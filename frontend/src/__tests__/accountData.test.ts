import { beforeEach, describe, expect, it } from 'vitest';
import { useAuthStore } from '../store/useAuthStore';
import { useClothingStore } from '../store/useClothingStore';
import { useOutfitStore } from '../store/useOutfitStore';
import { usePersonaStore } from '../store/usePersonaStore';
import { ACCOUNT_STORAGE_KEYS, clearStoredAccountData } from '../utils/accountData';
import { resetAccountStores } from '../utils/resetAccountStores';
import { makeItems, makeUser } from '../test/fixtures';

// Audit H4: signing out must not leave the previous account's closet in this browser or in memory.
beforeEach(() => {
  localStorage.clear();
  useAuthStore.getState().login('token', makeUser());
  useClothingStore.setState({ items: makeItems(3), favorites: [1, 2] });
  localStorage.setItem('closet-favorites', JSON.stringify([1, 2]));
  localStorage.setItem('vysvi-theme', 'dark');
});

describe('clearStoredAccountData', () => {
  it('removes the closet cache, favourites and persona choice, and nothing else', () => {
    for (const key of ACCOUNT_STORAGE_KEYS) localStorage.setItem(key, '{}');

    clearStoredAccountData();

    for (const key of ACCOUNT_STORAGE_KEYS) expect(localStorage.getItem(key)).toBeNull();
    expect(localStorage.getItem('vysvi-theme')).toBe('dark');
  });
});

describe('logout', () => {
  it('wipes the saved account data from the browser', () => {
    expect(localStorage.getItem('clothing-closet-storage')).not.toBeNull();

    useAuthStore.getState().logout();

    expect(localStorage.getItem('clothing-closet-storage')).toBeNull();
    expect(localStorage.getItem('closet-favorites')).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});

describe('resetAccountStores', () => {
  it('empties the closet, outfits and favourites in memory and in the browser', () => {
    useOutfitStore.setState({ outfits: [{ outfitId: 1 } as never], mainOutfitId: 1 });
    usePersonaStore.setState({ persona: { ...usePersonaStore.getState().persona, topIds: [9] } });

    resetAccountStores();

    expect(useClothingStore.getState().items).toEqual([]);
    expect(useClothingStore.getState().favorites).toEqual([]);
    expect(useOutfitStore.getState().outfits).toEqual([]);
    expect(usePersonaStore.getState().persona.topIds).toEqual([]);
    expect(JSON.parse(localStorage.getItem('clothing-closet-storage') ?? '{"state":{"items":[]}}').state.items).toEqual([]);
    expect(JSON.parse(localStorage.getItem('closet-favorites') ?? '[]')).toEqual([]);
  });
});
