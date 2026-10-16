import { useCallback, useState } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { useClothingStore } from '../store/useClothingStore';

// Task 101: whether to show the first-run guide. "Done" is derived from the account's data (no
// garments yet, or no outfit yet); only "the user hid the guide" is stored, in this browser and
// per account, so a shared browser does not carry it from one user to another.
const keyFor = (userId: number | undefined) => `vysvi-onboarding:${userId ?? 'anon'}`;

const readDismissed = (key: string): boolean => {
  try {
    return localStorage.getItem(key) === 'dismissed';
  } catch {
    return false;
  }
};

// `outfitCount`: pass the number of saved outfits where it is known (the Showcase); leave it out
// on pages that only care about an empty closet.
export function useFirstRun(outfitCount?: number) {
  const userId = useAuthStore((state) => state.user?.userId);
  const itemCount = useClothingStore((state) => state.items.length);
  const key = keyFor(userId);
  const [dismissed, setDismissed] = useState(() => readDismissed(key));

  // Hides the guide for this account (and remembers it).
  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(key, 'dismissed');
    } catch {
      // Storage blocked: the guide is only hidden until the page reloads.
    }
    setDismissed(true);
  }, [key]);

  const needsGarments = itemCount === 0;
  const needsOutfit = outfitCount !== undefined && outfitCount === 0;
  return {
    show: !dismissed && (needsGarments || needsOutfit),
    dismiss,
    hasGarments: itemCount > 0,
    hasOutfit: (outfitCount ?? 0) > 0,
  };
}
