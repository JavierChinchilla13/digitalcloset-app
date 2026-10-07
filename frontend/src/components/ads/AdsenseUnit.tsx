import { useEffect, useRef } from 'react';

const SCRIPT_SRC = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js';

// Adds Google's ad script to the page, once, the first time a unit is shown (so visitors who
// never see an ad - paying users, admins - never download it).
function ensureScript(client: string) {
  if (document.querySelector(`script[src^="${SCRIPT_SRC}"]`)) return;
  const script = document.createElement('script');
  script.async = true;
  script.crossOrigin = 'anonymous';
  script.src = `${SCRIPT_SRC}?client=${encodeURIComponent(client)}`;
  document.head.appendChild(script);
}

// One AdSense display unit. AdSense fills an <ins> element once; the page is a single-page app, so
// the caller gives this component a `key` that changes with the route (a fresh element for each
// page) and the guard below skips an element that was already filled (React StrictMode runs
// effects twice in development).
const AdsenseUnit = ({ client, slot }: { client: string; slot: string }) => {
  const ref = useRef<HTMLModElement>(null);

  useEffect(() => {
    ensureScript(client);
    const ins = ref.current;
    if (!ins || ins.getAttribute('data-adsbygoogle-status')) return;
    try {
      // Pushing right away is safe: AdSense reads this queue when its script arrives.
      const w = window as unknown as { adsbygoogle?: unknown[] };
      (w.adsbygoogle = w.adsbygoogle || []).push({});
    } catch (err) {
      console.error('AdSense unit failed', err);
    }
  }, [client, slot]);

  return (
    <ins
      ref={ref}
      className="adsbygoogle"
      style={{ display: 'block', width: '100%' }}
      data-ad-client={client}
      data-ad-slot={slot}
      data-ad-format="auto"
      data-full-width-responsive="true"
    />
  );
};

export default AdsenseUnit;
