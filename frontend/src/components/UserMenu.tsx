import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { LogOut, ShieldCheck, Tag, UserCircle, Settings as SettingsIcon } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import ThemeToggle from './ThemeToggle';

// Task 79: the navbar used to lay Persona/Categories/Admin/Logout out as
// separate always-visible icons next to the user avatar - "too cluttered."
// They (plus Theme, previously its own icon further out, and the new
// Settings page) now live in one dropdown off the avatar, opened by hover
// (with a short close delay, so crossing the gap to the panel doesn't
// flicker it shut) and by click/tap, closed by a click outside - the same
// hover/click-outside shape ClothingCategoryFilter.tsx already uses for its
// own dropdown.
const CLOSE_DELAY_MS = 150;

const UserMenu = () => {
  const { isAdmin, user, logout } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  const open = () => {
    cancelClose();
    setIsOpen(true);
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setIsOpen(false), CLOSE_DELAY_MS);
  };
  const close = () => {
    cancelClose();
    setIsOpen(false);
  };

  const itemClass =
    'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[10px] font-medium uppercase tracking-widest text-text-secondary hover:bg-ink/5 hover:text-text-primary transition-colors';

  return (
    <div className="relative" onMouseEnter={open} onMouseLeave={scheduleClose}>
      <button
        type="button"
        // Just opens (never toggles): a real click also fires a hover/pointer-
        // enter first, which already opened the menu, so a naive toggle here
        // would immediately close what hovering just opened. Touch devices
        // (no hover) still get click-to-open; closing is via outside-click,
        // mouse-leave, or picking a menu item.
        onClick={open}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label="Account menu"
        className="w-7 h-7 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center text-accent text-[10px] font-medium hover:bg-accent/30 transition-colors"
      >
        {user?.email[0].toUpperCase()}
      </button>

      {isOpen && (
        <>
          {/* Click-outside-to-close overlay, same pattern as ClothingCategoryFilter.
              data-testid: in a real browser this fixed, full-viewport div sits
              on top and captures the click regardless of what's visually under
              it; jsdom doesn't do hit-testing/paint, so a test can't click "some
              unrelated element" and expect it to land here - it has to target
              this element directly, same as a real click would land on it. */}
          <div data-testid="user-menu-overlay" className="fixed inset-0 z-30" onClick={close} />
          <div
            role="menu"
            // Centered under the avatar (left-1/2 -translate-x-1/2), not
            // right-aligned to it - user feedback, 2026-09-28: right-aligning
            // put the whole panel to one side of the button instead of under it.
            className="absolute left-1/2 -translate-x-1/2 top-full mt-3 w-52 bg-background-secondary border border-ink/10 rounded-2xl shadow-lg p-2 z-40 space-y-1"
          >
            {/* A small caret so the panel visually reads as belonging to the
                avatar it hangs below - centered the same way the panel is. */}
            <div
              aria-hidden
              className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bg-background-secondary border-t border-l border-ink/10"
            />
            <div className="px-3 py-2 text-[9px] font-bold text-text-secondary/60 uppercase tracking-widest truncate">
              {user?.email}
            </div>

            {/* Theme sits inline as a menu row rather than its own icon now. */}
            <div className={itemClass}>
              <ThemeToggleRow />
            </div>

            <Link to="/persona" onClick={close} className={itemClass}>
              <UserCircle size={14} /> Persona
            </Link>
            <Link to="/categories" onClick={close} className={itemClass}>
              <Tag size={14} /> Categories
            </Link>
            {isAdmin && (
              <Link to="/admin" onClick={close} className={itemClass}>
                <ShieldCheck size={14} /> Admin
              </Link>
            )}
            <Link to="/settings" onClick={close} className={itemClass}>
              <SettingsIcon size={14} /> Settings
            </Link>

            <div className="h-px bg-ink/10 my-1" />

            <button
              type="button"
              onClick={() => {
                close();
                logout();
              }}
              className={itemClass}
            >
              <LogOut size={14} /> Logout
            </button>
          </div>
        </>
      )}
    </div>
  );
};

// ThemeToggle is a self-contained icon button; this wraps it with a label so
// it reads as a normal menu row instead of a lone icon.
const ThemeToggleRow = () => (
  <div className="flex items-center gap-3 w-full">
    <ThemeToggle />
    <span>Theme</span>
  </div>
);

export default UserMenu;
