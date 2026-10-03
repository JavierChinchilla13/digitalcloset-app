import { useEffect, useState } from 'react';

// Whether a CSS media query currently matches, kept up to date as the window changes
// (rotating a phone, resizing a window). `fallback` is what to answer where there is
// no matchMedia (the test environment, server rendering). Used when a layout needs
// different *content* on phones and wide screens, not just different styling - e.g.
// the builder renders its secondary actions in the header on a wide screen but at the
// top of the Outfit tab on a phone, and rendering both would duplicate every button.
export function useMediaQuery(query: string, fallback: boolean): boolean {
  const read = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : fallback);
  const [matches, setMatches] = useState(read);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const list = window.matchMedia(query);
    const update = () => setMatches(list.matches);
    update();
    list.addEventListener('change', update);
    return () => list.removeEventListener('change', update);
  }, [query]);

  return matches;
}
