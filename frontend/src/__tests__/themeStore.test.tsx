import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Task 82: the app opens in the device's theme, and the toggle only ever
// flips light <-> dark - there is no "system" state.
//
// The store reads localStorage and the OS setting when its module loads, so
// each test sets those up first and then imports a fresh copy of it.

type Listener = () => void;
let osListeners: Listener[] = [];

// `keepListeners` simulates the device changing its setting while the app is
// already running (the store's listener stays registered and re-reads it).
const mockDevice = (dark: boolean, keepListeners = false) => {
  if (!keepListeners) osListeners = [];
  window.matchMedia = ((query: string) => ({
    matches: dark,
    media: query,
    onchange: null,
    addEventListener: (_: string, fn: Listener) => osListeners.push(fn),
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
};

const loadStore = async () => {
  vi.resetModules();
  return import('../store/useThemeStore');
};

describe('theme store', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.colorScheme = '';
  });

  it('starts dark when the device is dark and nothing is saved', async () => {
    mockDevice(true);
    const { useThemeStore, initTheme } = await loadStore();
    initTheme();

    expect(useThemeStore.getState().resolved).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('starts light when the device is light and nothing is saved', async () => {
    mockDevice(false);
    const { useThemeStore, initTheme } = await loadStore();
    initTheme();

    expect(useThemeStore.getState().resolved).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('a saved choice beats the device', async () => {
    mockDevice(true);
    localStorage.setItem('vysvi-theme', 'light');
    const { useThemeStore } = await loadStore();

    expect(useThemeStore.getState().resolved).toBe('light');
  });

  it("an old saved 'system' is ignored and follows the device", async () => {
    mockDevice(true);
    localStorage.setItem('vysvi-theme', 'system');
    const { useThemeStore } = await loadStore();

    expect(useThemeStore.getState().resolved).toBe('dark');
  });

  it('toggling flips light <-> dark, applies it and saves it - never "system"', async () => {
    mockDevice(false);
    const { useThemeStore, initTheme } = await loadStore();
    initTheme();

    const seen: string[] = [];
    for (let i = 0; i < 4; i++) {
      useThemeStore.getState().togglePreference();
      seen.push(useThemeStore.getState().preference);
    }

    expect(seen).toEqual(['dark', 'light', 'dark', 'light']);
    expect(localStorage.getItem('vysvi-theme')).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('follows the device live until the user has chosen, then stops', async () => {
    mockDevice(false);
    const { useThemeStore, initTheme } = await loadStore();
    initTheme();
    expect(useThemeStore.getState().resolved).toBe('light');

    // Device flips to dark while the user has not chosen anything.
    mockDevice(true, true);
    osListeners.forEach((fn) => fn());
    expect(useThemeStore.getState().resolved).toBe('dark');

    // The user picks light; a later device change must not override it.
    useThemeStore.getState().setPreference('light');
    mockDevice(true, true);
    osListeners.forEach((fn) => fn());
    expect(useThemeStore.getState().resolved).toBe('light');
  });

  it('the toggle shows the current theme and never a monitor / system option', async () => {
    mockDevice(true);
    vi.resetModules();
    const { default: ThemeToggle } = await import('../components/ThemeToggle');
    const user = userEvent.setup();
    render(<ThemeToggle />);

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-label', 'Theme: Dark. Click to change.');
    expect(document.querySelector('svg.lucide-monitor')).toBeNull();

    await user.click(button);
    expect(button).toHaveAttribute('aria-label', 'Theme: Light. Click to change.');
    await user.click(button);
    expect(button).toHaveAttribute('aria-label', 'Theme: Dark. Click to change.');
    expect(document.querySelector('svg.lucide-monitor')).toBeNull();
  });
});
