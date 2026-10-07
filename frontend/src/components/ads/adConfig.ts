// Task 97: which ad network is switched on, read from the build's VITE_ variables (public values,
// baked into the site when it is built - never a secret). Nothing is configured by default, so
// ads stay completely off until the owner sets VITE_AD_PROVIDER.
//
//   VITE_AD_PROVIDER=adsense   + VITE_ADSENSE_CLIENT (ca-pub-...) + VITE_ADSENSE_SLOT (digits)
//       Google AdSense - needs a domain you own (it does not approve *.onrender.com).
//   VITE_AD_PROVIDER=adsterra  + VITE_ADSTERRA_SCRIPT_URL (the .../invoke.js address from the ad unit's
//       code) + VITE_ADSTERRA_KEY + VITE_ADSTERRA_WIDTH / VITE_ADSTERRA_HEIGHT (the unit's size)
//       A network that accepts free subdomains. Banner units only.
//
// A provider with a missing or malformed value counts as "not configured" (no ad), never as a
// half-working one.

export type AdConfig =
  | { provider: 'adsense'; client: string; slot: string }
  | { provider: 'adsterra'; scriptUrl: string; key: string; width: number; height: number };

const clean = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

// The invoke.js address an ad unit's code gives (often written protocol-relative, "//host/key/invoke.js").
// Only an https address ending in /invoke.js is accepted.
function normalizeScriptUrl(value: string): string | null {
  const absolute = value.startsWith('//') ? `https:${value}` : value;
  try {
    const url = new URL(absolute);
    return url.protocol === 'https:' && url.pathname.endsWith('/invoke.js') ? url.toString() : null;
  } catch {
    return null;
  }
}

const dimension = (value: unknown): number | null => {
  const n = Number(clean(value));
  return Number.isInteger(n) && n >= 1 && n <= 1000 ? n : null;
};

/**
 * The ad setup for this build, or null when ads are off (no provider chosen, an unknown provider,
 * or its values missing / malformed). Read at call time, so tests can stub the environment.
 */
export function getAdConfig(): AdConfig | null {
  const env = import.meta.env;
  const provider = clean(env.VITE_AD_PROVIDER).toLowerCase();

  if (provider === 'adsense') {
    const client = clean(env.VITE_ADSENSE_CLIENT);
    const slot = clean(env.VITE_ADSENSE_SLOT);
    return /^ca-pub-\d{8,20}$/.test(client) && /^\d{4,20}$/.test(slot) ? { provider, client, slot } : null;
  }

  if (provider === 'adsterra') {
    const scriptUrl = normalizeScriptUrl(clean(env.VITE_ADSTERRA_SCRIPT_URL));
    const key = clean(env.VITE_ADSTERRA_KEY);
    const width = dimension(env.VITE_ADSTERRA_WIDTH);
    const height = dimension(env.VITE_ADSTERRA_HEIGHT);
    return scriptUrl && /^[A-Za-z0-9_-]{8,64}$/.test(key) && width && height ? { provider, scriptUrl, key, width, height } : null;
  }

  return null;
}
