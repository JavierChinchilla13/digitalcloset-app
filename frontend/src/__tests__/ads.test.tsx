import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import AdSlot from '../components/ads/AdSlot';
import { getAdConfig } from '../components/ads/adConfig';
import { useAuthStore } from '../store/useAuthStore';
import { Plan, Role } from '../types';
import { makeUser } from '../test/fixtures';

// Task 97: ads are for signed-in FREE accounts only, off unless a network is configured, never on
// the account / admin / signed-out pages, and the free-subdomain network runs in a sandboxed frame.
const ADSENSE = {
  VITE_AD_PROVIDER: 'adsense',
  VITE_ADSENSE_CLIENT: 'ca-pub-1234567890123456',
  VITE_ADSENSE_SLOT: '1234567890',
};
const ADSTERRA = {
  VITE_AD_PROVIDER: 'adsterra',
  VITE_ADSTERRA_SCRIPT_URL: '//ads.example-network.com/abcdef1234567890/invoke.js',
  VITE_ADSTERRA_KEY: 'abcdef1234567890',
  VITE_ADSTERRA_WIDTH: '320',
  VITE_ADSTERRA_HEIGHT: '50',
};
const ALL_VARS = ['VITE_AD_PROVIDER', ...Object.keys(ADSENSE), ...Object.keys(ADSTERRA)];

function setEnv(values: Record<string, string>) {
  for (const name of ALL_VARS) vi.stubEnv(name, '');
  for (const [name, value] of Object.entries(values)) vi.stubEnv(name, value);
}

// jsdom reports every media query as "no match"; say the screen is wide, or a banner would be skipped.
function stubWideScreen(wide: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: wide,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}

const renderSlot = (path = '/closet') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AdSlot />
    </MemoryRouter>
  );

const realMatchMedia = window.matchMedia;

beforeEach(() => {
  setEnv({});
  stubWideScreen(true);
  useAuthStore.getState().logout();
  document.head.querySelectorAll('script[src*="googlesyndication"]').forEach((el) => el.remove());
});

afterEach(() => {
  vi.unstubAllEnvs();
  window.matchMedia = realMatchMedia;
});

describe('getAdConfig', () => {
  it('is off by default', () => {
    expect(getAdConfig()).toBeNull();
  });

  it('reads an AdSense setup', () => {
    setEnv(ADSENSE);
    expect(getAdConfig()).toEqual({ provider: 'adsense', client: 'ca-pub-1234567890123456', slot: '1234567890' });
  });

  it('reads an Adsterra-style setup, making a protocol-relative address https', () => {
    setEnv(ADSTERRA);
    expect(getAdConfig()).toEqual({
      provider: 'adsterra',
      scriptUrl: 'https://ads.example-network.com/abcdef1234567890/invoke.js',
      key: 'abcdef1234567890',
      width: 320,
      height: 50,
    });
  });

  it('a provider with a missing or malformed value is not configured', () => {
    setEnv({ ...ADSENSE, VITE_ADSENSE_CLIENT: 'not-a-publisher-id' });
    expect(getAdConfig()).toBeNull();
    setEnv({ ...ADSENSE, VITE_ADSENSE_SLOT: '' });
    expect(getAdConfig()).toBeNull();
    setEnv({ ...ADSTERRA, VITE_ADSTERRA_SCRIPT_URL: 'http://ads.example.com/x/invoke.js' }); // not https
    expect(getAdConfig()).toBeNull();
    setEnv({ ...ADSTERRA, VITE_ADSTERRA_SCRIPT_URL: 'https://ads.example.com/x/other.js' }); // not invoke.js
    expect(getAdConfig()).toBeNull();
    setEnv({ ...ADSTERRA, VITE_ADSTERRA_WIDTH: '0' });
    expect(getAdConfig()).toBeNull();
    setEnv({ ...ADSTERRA, VITE_ADSTERRA_KEY: 'bad key!' });
    expect(getAdConfig()).toBeNull();
  });

  it('an unknown provider is off', () => {
    setEnv({ VITE_AD_PROVIDER: 'some-other-network' });
    expect(getAdConfig()).toBeNull();
  });
});

describe('who sees the ad slot', () => {
  beforeEach(() => setEnv(ADSENSE));

  it('a signed-in free account sees it', () => {
    useAuthStore.getState().login('t', makeUser());
    renderSlot();

    expect(screen.getByTestId('ad-slot')).toBeInTheDocument();
    expect(screen.getByText('Advertisement')).toBeInTheDocument();
  });

  it('a visitor who is not signed in does not', () => {
    renderSlot();
    expect(screen.queryByTestId('ad-slot')).not.toBeInTheDocument();
  });

  it('a premium account does not', () => {
    useAuthStore.getState().login('t', makeUser({ plan: Plan.PREMIUM, garmentLimit: 300 }));
    renderSlot();
    expect(screen.queryByTestId('ad-slot')).not.toBeInTheDocument();
  });

  it('an admin does not', () => {
    useAuthStore.getState().login('t', makeUser({ role: Role.ROLE_ADMIN, garmentLimit: null }));
    renderSlot();
    expect(screen.queryByTestId('ad-slot')).not.toBeInTheDocument();
  });

  it('nobody does when no ad network is configured', () => {
    setEnv({});
    useAuthStore.getState().login('t', makeUser());
    renderSlot();
    expect(screen.queryByTestId('ad-slot')).not.toBeInTheDocument();
  });

  it('the account, admin and sign-in pages never carry one', () => {
    useAuthStore.getState().login('t', makeUser());
    for (const path of ['/admin', '/persona', '/login', '/signup', '/forgot-password', '/reset-password', '/demo']) {
      const { unmount } = renderSlot(path);
      expect(screen.queryByTestId('ad-slot'), path).not.toBeInTheDocument();
      unmount();
    }
    for (const path of ['/closet', '/outfits', '/showcase', '/settings', '/categories', '/']) {
      const { unmount } = renderSlot(path);
      expect(screen.getByTestId('ad-slot'), path).toBeInTheDocument();
      unmount();
    }
  });
});

describe('the AdSense unit', () => {
  beforeEach(() => {
    setEnv(ADSENSE);
    useAuthStore.getState().login('t', makeUser());
  });

  it('renders the standard ad element and loads Google\'s script once', () => {
    const first = renderSlot();
    const ins = document.querySelector('ins.adsbygoogle');
    expect(ins).toHaveAttribute('data-ad-client', 'ca-pub-1234567890123456');
    expect(ins).toHaveAttribute('data-ad-slot', '1234567890');
    first.unmount();
    renderSlot('/outfits');

    const scripts = document.head.querySelectorAll('script[src*="googlesyndication"]');
    expect(scripts).toHaveLength(1);
    expect(scripts[0].getAttribute('src')).toContain('client=ca-pub-1234567890123456');
  });

  it('does not load the ad script for visitors who never see an ad', () => {
    useAuthStore.getState().login('t', makeUser({ plan: Plan.PREMIUM, garmentLimit: 300 }));
    renderSlot();
    expect(document.head.querySelectorAll('script[src*="googlesyndication"]')).toHaveLength(0);
  });
});

describe('the Adsterra-style banner', () => {
  beforeEach(() => {
    setEnv(ADSTERRA);
    useAuthStore.getState().login('t', makeUser());
  });

  it('runs in a sandboxed frame that cannot reach this site\'s storage', () => {
    renderSlot();

    const frame = screen.getByTitle('Advertisement') as HTMLIFrameElement;
    const sandbox = frame.getAttribute('sandbox') ?? '';
    expect(sandbox).toContain('allow-scripts');
    expect(sandbox).toContain('allow-popups');
    // allow-same-origin would give the ad script this site's localStorage (the sign-in token).
    expect(sandbox).not.toContain('allow-same-origin');
    expect(frame).toHaveAttribute('width', '320');
    expect(frame).toHaveAttribute('height', '50');
  });

  it('the frame holds the network\'s snippet with this unit\'s key and size', () => {
    renderSlot();

    const doc = (screen.getByTitle('Advertisement') as HTMLIFrameElement).getAttribute('srcdoc') ?? '';
    expect(doc).toContain('"key":"abcdef1234567890"');
    expect(doc).toContain('"width":320');
    expect(doc).toContain('"height":50');
    expect(doc).toContain('src="https://ads.example-network.com/abcdef1234567890/invoke.js"');
    expect(doc.match(/<script/g)).toHaveLength(2);
  });

  it('a banner wider than the screen is skipped, not clipped', () => {
    setEnv({ ...ADSTERRA, VITE_ADSTERRA_WIDTH: '728', VITE_ADSTERRA_HEIGHT: '90' });
    stubWideScreen(false);
    renderSlot();

    expect(screen.queryByTestId('ad-slot')).not.toBeInTheDocument();
  });
});
