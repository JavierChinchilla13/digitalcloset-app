import { useCallback, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../store/useAuthStore';
import { cn } from '../utils/cn';
import ThemeToggle from './ThemeToggle';
import BrandMark from './BrandMark';
import UserMenu from './UserMenu';
import MobileMenu from './MobileMenu';
import { NAV_LINKS } from './navLinks';
import { Menu } from 'lucide-react';

const Navbar = () => {
  const { isAuthenticated } = useAuthStore();
  const location = useLocation();

  // Phone navigation (Task 91): below md the links don't fit in the pill, so a menu
  // button opens MobileMenu (a full-screen sheet) instead.
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex justify-center px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:p-6 pointer-events-none">
      <motion.div 
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="glass-panel px-4 sm:px-6 md:px-8 py-3 rounded-full flex items-center gap-3 sm:gap-8 md:gap-12 border border-ink/10 shadow-lg pointer-events-auto"
      >
        {/* Logo - Task 72: VYSVI wordmark (see BrandMark.tsx for why it's
            still text, not the real logo image). Task 75: signed-in users
            go to the new Outfit Showcase instead of "/" - guests keep
            landing on LandingPage (they have no outfits to showcase). */}
        <Link to={isAuthenticated ? '/showcase' : '/'} className="hover:opacity-70 transition-opacity">
          <BrandMark />
        </Link>

        {/* Center Links */}
        <div className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map((link) => {
            const showLink = link.protected
              ? isAuthenticated
              : link.publicOnly
                ? !isAuthenticated
                : true;

            const isActive = location.pathname === link.path;

            return showLink && (
              <Link
                key={link.path}
                to={link.path}
                className={cn(
                  "text-[10px] font-medium uppercase tracking-[0.2em] transition-all relative py-1",
                  isActive ? "text-accent" : "text-text-secondary hover:text-text-primary"
                )}
              >
                {link.name}
                <AnimatePresence>
                  {isActive && (
                    <motion.div 
                      layoutId="nav-underline"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute -bottom-1 left-0 right-0 h-[2px] bg-accent"
                    />
                  )}
                </AnimatePresence>
              </Link>
            )
          })}
        </div>

        {/* Auth Buttons - Task 69: padding/gaps step down at each breakpoint
            (found in Task 67: the pill was already wider than a 375px phone
            before the toggle even existed) so the pill fits a phone screen
            without hiding any of the icon links. */}
        <div className="flex items-center gap-1 sm:gap-3 md:gap-4 border-l border-ink/10 pl-2 sm:pl-6 md:pl-8">
          {isAuthenticated ? (
            // Task 79: Persona/Categories/Admin/Logout/Theme used to be
            // separate always-visible icons here - "too cluttered." They
            // (plus the new Settings page) now live in one dropdown off the
            // avatar; see UserMenu.tsx. Phones get the menu button instead (the
            // sheet has everything the dropdown does, plus the main pages).
            <>
              <div className="hidden md:block">
                <UserMenu />
              </div>
              <button
                type="button"
                onClick={() => setMenuOpen(true)}
                aria-label="Open menu"
                aria-haspopup="dialog"
                aria-expanded={menuOpen}
                className="md:hidden w-11 h-11 -my-1 rounded-full flex items-center justify-center text-text-primary hover:bg-ink/5 active:bg-ink/10 transition-colors"
              >
                <Menu size={20} />
              </button>
            </>
          ) : (
            <>
              {/* Task 67: light / dark toggle - shown logged out;
                  logged in, it moved into UserMenu's dropdown. */}
              <ThemeToggle />
              <Link
                to="/login" 
                className="text-[10px] font-medium uppercase tracking-widest text-text-secondary hover:text-text-primary transition-colors"
              >
                Login
              </Link>
              <Link 
                to="/signup" 
                className="bg-accent hover:bg-accent-hover text-on-accent px-4 sm:px-6 py-2.5 rounded-full text-[10px] font-medium uppercase tracking-widest transition-all transform hover:scale-105 active:scale-95 shadow-lg"
              >
                Join
              </Link>
            </>
          )}
        </div>
      </motion.div>
      <MobileMenu isOpen={menuOpen} onClose={closeMenu} />
    </nav>
  );
};

export default Navbar;
