import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Task 99: what the visitor allowed on the cookie / privacy banner.
//  - 'unset'     : not decided yet (the banner is showing; optional services stay off)
//  - 'essential' : only what the app needs to work (sign-in token, theme, closet cache)
//  - 'all'       : also the optional services - ads for free accounts, error monitoring
// Anything that sends data to a third party for reasons other than doing what the visitor asked
// (an ad network, error reports) must check `choice === 'all'` first (see hooks/useConsent.ts).
export type ConsentChoice = 'unset' | 'essential' | 'all';

interface ConsentState {
  choice: ConsentChoice;
  // When the choice was made (ISO), so a policy change can ask again later.
  decidedAt: string | null;
  // True while the banner is open again after being dismissed (footer "Cookie settings").
  // Not persisted: a reload goes back to showing it only when no choice was made.
  reopened: boolean;
  accept: () => void;
  reject: () => void;
  reopen: () => void;
}

export const useConsentStore = create<ConsentState>()(
  persist(
    (set) => ({
      choice: 'unset',
      decidedAt: null,
      reopened: false,
      // "Accept all": the optional services may run.
      accept: () => set({ choice: 'all', decidedAt: new Date().toISOString(), reopened: false }),
      // "Only essentials": nothing optional runs.
      reject: () => set({ choice: 'essential', decidedAt: new Date().toISOString(), reopened: false }),
      // Footer link: show the banner again so the choice can be changed.
      reopen: () => set({ reopened: true }),
    }),
    {
      name: 'vysvi-consent',
      partialize: (state) => ({ choice: state.choice, decidedAt: state.decidedAt }),
    }
  )
);
