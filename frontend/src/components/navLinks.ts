import { Shirt, LayoutPanelTop, PlayCircle, UserCircle } from 'lucide-react';

// The main places in the app, shared by the desktop navbar (Navbar.tsx) and the
// phone menu (MobileMenu.tsx) so the two can't drift apart.
//
// "Attire" points at / (Task 40, Phase 8 pivot) - the flat outfit builder
// (Task 36-39), which already contains the List/Persona preview toggle (Task 38).
// /persona (a separate, standalone persona-type picker) is no longer in the primary
// nav - it lives in the account menu.
export interface NavLink {
  name: string;
  path: string;
  icon: typeof Shirt;
  // Only shown when signed in.
  protected: boolean;
  // Only shown to visitors (the demo makes no sense once you have a closet).
  publicOnly?: boolean;
}

export const NAV_LINKS: NavLink[] = [
  { name: 'Attire', path: '/', icon: UserCircle, protected: true },
  { name: 'Closet', path: '/closet', icon: Shirt, protected: true },
  { name: 'Outfits', path: '/outfits', icon: LayoutPanelTop, protected: true },
  { name: 'Demo', path: '/demo', icon: PlayCircle, protected: false, publicOnly: true },
];
