import { useLocation } from 'react-router-dom';
import { useAdEligibility } from '../../hooks/useAdEligibility';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import AdsenseUnit from './AdsenseUnit';
import BannerFrame from './BannerFrame';

// Pages that never carry an ad: the account / admin screens and the signed-out flows. (The builder
// pages are full-height, so the slot - which sits under the page, above the footer - is below the
// fold there and never competes with the closet or the persona.)
const NO_AD_PREFIXES = ['/admin', '/persona', '/login', '/signup', '/forgot-password', '/reset-password', '/demo'];

// Task 97: the one ad slot of the app, placed in the page frame just above the footer. Shows
// nothing - and loads no ad script - unless the visitor is a signed-in free account and an ad
// network is configured (see useAdEligibility / adConfig). Labelled "Advertisement", not sticky
// or floating (the phone layouts have their own bottom bars), and a banner too wide for the
// screen is skipped rather than clipped.
const AdSlot = () => {
  const config = useAdEligibility();
  const { pathname } = useLocation();
  // Without a banner there is nothing to measure; a wide banner needs room beside the page padding.
  const bannerWidth = config?.provider === 'adsterra' ? config.width : 0;
  const bannerFits = useMediaQuery(`(min-width: ${bannerWidth + 32}px)`, true);

  if (!config) return null;
  if (NO_AD_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) return null;
  if (config.provider === 'adsterra' && !bannerFits) return null;

  return (
    <aside aria-label="Advertisement" data-testid="ad-slot" className="px-4 pb-10">
      <p className="mb-2 text-center text-[9px] font-medium uppercase tracking-[0.3em] text-text-secondary/50">Advertisement</p>
      <div className="mx-auto flex max-w-5xl justify-center overflow-hidden">
        {config.provider === 'adsense' ? (
          // A new element for every page: AdSense fills an element only once.
          <AdsenseUnit key={pathname} client={config.client} slot={config.slot} />
        ) : (
          <BannerFrame scriptUrl={config.scriptUrl} adKey={config.key} width={config.width} height={config.height} />
        )}
      </div>
    </aside>
  );
};

export default AdSlot;
