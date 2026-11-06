import { useBillingStore } from '../store/useBillingStore';
import { useClothingStore } from '../store/useClothingStore';
import { useCollectionStore } from '../store/useCollectionStore';
import { useOutfitDraftStore } from '../store/useOutfitDraftStore';
import { useOutfitStore } from '../store/useOutfitStore';
import { usePersonaSettingsStore } from '../store/usePersonaSettingsStore';
import { usePersonaStore } from '../store/usePersonaStore';
import { clearStoredAccountData } from './accountData';

// Audit H4: empties every in-memory store that holds an account's data and wipes what was saved in
// the browser. Signing out inside the app does not reload the page, so without this the next sign-in
// (or the next page, until its fetch returns) would show the previous account's closet and outfits.
export function resetAccountStores(): void {
  // Not the whole initial state for the closet: its `_hasHydrated` flag must stay as it is.
  useClothingStore.setState({ items: [], favorites: [], isLoading: false, error: null });
  useOutfitStore.setState(useOutfitStore.getInitialState(), true);
  useCollectionStore.setState(useCollectionStore.getInitialState(), true);
  useOutfitDraftStore.setState(useOutfitDraftStore.getInitialState(), true);
  usePersonaSettingsStore.setState(usePersonaSettingsStore.getInitialState(), true);
  useBillingStore.setState(useBillingStore.getInitialState(), true);
  usePersonaStore.setState(usePersonaStore.getInitialState(), true);
  clearStoredAccountData();
}
