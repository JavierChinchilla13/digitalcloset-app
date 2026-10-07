import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { LogOut, Settings as SettingsIcon, ShieldCheck, Sparkles, Tag, UserCircle, X } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { cn } from '../utils/cn';
import ThemeToggle from './ThemeToggle';
import StorageMeter from './StorageMeter';
import { NAV_LINKS } from './navLinks';

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

// Phone navigation (Task 91). Below the `md` breakpoint the navbar has no room for
// its links, so the signed-in pill shows a menu button that opens this full-screen
// sheet: the Showcase, the main pages (the same list the desktop navbar uses) and
// everything that lives in the desktop account dropdown (Categories, Persona,
// Settings, Admin, theme, log out). Rows are 48px tall so they are easy to tap.
// It closes on navigation (route change), on Escape, and with the X.
// (pointer-events-auto: the navbar that hosts it is pointer-events-none so its
// empty margins don't block the page.)
const MobileMenu = ({ isOpen, onClose }: MobileMenuProps) => {
  const { isAdmin, user, logout } = useAuthStore();
  const { pathname } = useLocation();

  // Follow the route: choosing a page (or the browser back button) closes the sheet.
  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // While open: Escape closes it, and the page behind does not scroll.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  const isActive = (path: string) => (path === '/' ? pathname === '/' : pathname.startsWith(path));

  const rowClass = (active: boolean) =>
    cn(
      'flex items-center gap-4 min-h-12 px-4 rounded-2xl text-xs font-medium uppercase tracking-[0.2em] transition-colors',
      active ? 'bg-accent/15 text-accent' : 'text-text-primary hover:bg-ink/5 active:bg-ink/10'
    );

  const links = [
    { name: 'Showcase', path: '/showcase', icon: Sparkles },
    ...NAV_LINKS.filter((link) => link.protected),
    { name: 'Categories', path: '/categories', icon: Tag },
    { name: 'Persona', path: '/persona', icon: UserCircle },
    ...(isAdmin ? [{ name: 'Admin', path: '/admin', icon: ShieldCheck }] : []),
    { name: 'Settings', path: '/settings', icon: SettingsIcon },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="pointer-events-auto fixed inset-0 z-[70] bg-background-main/95 backdrop-blur-xl overflow-y-auto pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
        >
          <div className="flex items-center justify-between px-6 h-20">
            <p className="text-[10px] font-medium text-text-secondary tracking-[0.3em] uppercase truncate pr-4">
              {user?.email}
            </p>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close menu"
              className="shrink-0 w-11 h-11 rounded-full border border-ink/10 flex items-center justify-center text-text-primary hover:bg-ink/5"
            >
              <X size={20} />
            </button>
          </div>

          {/* Task 96: how full the closet is, for accounts that have a limit. */}
          <StorageMeter compact className="px-6 pb-3" />

          <nav className="px-4 pb-10 space-y-1">
            {links.map((link) => {
              const Icon = link.icon;
              return (
                <Link key={link.path} to={link.path} className={rowClass(isActive(link.path))} aria-current={isActive(link.path) ? 'page' : undefined}>
                  <Icon size={18} /> {link.name}
                </Link>
              );
            })}

            <div className="h-px bg-ink/10 my-3 mx-2" />

            <div className={rowClass(false)}>
              <ThemeToggle />
              <span>Theme</span>
            </div>
            <button
              type="button"
              onClick={() => {
                onClose();
                logout();
              }}
              className={cn(rowClass(false), 'w-full text-left')}
            >
              <LogOut size={18} /> Log out
            </button>
          </nav>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default MobileMenu;
