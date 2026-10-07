import { useMemo } from 'react';

// The page inside the frame: the ad network's own two-step snippet (an options object, then its
// invoke.js script). Values go through JSON.stringify, so they cannot break out of the script.
// (The closing tag is written "<\/script>" so no HTML parser ever sees it inside a string.)
function buildDocument(scriptUrl: string, key: string, width: number, height: number, colorScheme: string): string {
  const options = JSON.stringify({ key, format: 'iframe', height, width, params: {} });
  return (
    `<!doctype html><html><head><meta charset="utf-8"><meta name="color-scheme" content="${colorScheme}">` +
    '<style>html,body{margin:0;padding:0;background:transparent;overflow:hidden}</style></head><body>' +
    `<script>atOptions = ${options.replace(/</g, '\\u003c')};<\/script>` +
    `<script src=${JSON.stringify(scriptUrl)}><\/script>` +
    '</body></html>'
  );
}

// Task 97: a third-party banner (Adsterra-style) shown inside a sandboxed frame. Two reasons:
//  - these snippets write themselves into the page with document.write, which would wipe a
//    single-page app that ran them directly;
//  - the frame has an opaque origin (the sandbox deliberately leaves out allow-same-origin), so the
//    network's script cannot read this site's localStorage - where the sign-in token lives.
// It may still run its own code and open the advertiser's page in a new tab when clicked.
const BannerFrame = ({ scriptUrl, adKey, width, height }: { scriptUrl: string; adKey: string; width: number; height: number }) => {
  // The frame declares the page's own light / dark scheme. Otherwise the browser paints an opaque
  // white backdrop behind a frame whose scheme differs from the page's, and an ad that is empty or
  // still loading would show as a white block on the dark theme.
  const srcDoc = useMemo(() => {
    const scheme = getComputedStyle(document.documentElement).colorScheme;
    return buildDocument(scriptUrl, adKey, width, height, scheme === 'dark' ? 'dark' : scheme === 'light' ? 'light' : 'normal');
  }, [scriptUrl, adKey, width, height]);
  return (
    <iframe
      title="Advertisement"
      srcDoc={srcDoc}
      width={width}
      height={height}
      sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
      loading="lazy"
      scrolling="no"
      className="border-0 max-w-full"
    />
  );
};

export default BannerFrame;
