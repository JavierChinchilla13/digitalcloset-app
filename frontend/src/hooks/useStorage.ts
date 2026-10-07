import { useAuthStore } from '../store/useAuthStore';
import { useClothingStore } from '../store/useClothingStore';
import { computeStorage, type StorageUsage } from '../utils/storage';

// Task 96: the signed-in account's garment space, live. The count comes from the closet the
// client already holds (it stays right as garments are added and deleted; the server's user
// record would go stale), the limit from the account (utils/storage.ts has the arithmetic).
export function useStorage(): StorageUsage {
  const user = useAuthStore((state) => state.user);
  const used = useClothingStore((state) => state.items.length);
  return computeStorage(user, used);
}
