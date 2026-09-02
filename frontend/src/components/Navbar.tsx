import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../store/useAuthStore';
import { cn } from '../utils/cn';
import { LogOut, Shirt, LayoutPanelTop, PlayCircle, UserCircle } from 'lucide-react';

const Navbar = () => {
  const { isAuthenticated, user, logout } = useAuthStore();
  const location = useLocation();

  // "Attire" points at / (Task 40, Phase 8 pivot) - the flat outfit builder
  // (Task 36-39), which already contains the List/Persona preview toggle
  // (Task 38). /persona (a separate, standalone persona-type picker) stays
  // reachable by direct URL, just no longer linked from primary nav - same
  // pattern as /dashboard in Task 39.
  const navLinks = [
    { name: 'Attire', path: '/', icon: UserCircle, protected: true },
    { name: 'Closet', path: '/closet', icon: Shirt, protected: true },
    { name: 'Outfits', path: '/outfits', icon: LayoutPanelTop, protected: true },
    { name: 'Demo', path: '/demo', icon: PlayCircle, protected: false, publicOnly: true },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex justify-center p-6 pointer-events-none">
      <motion.div 
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="glass-panel px-8 py-3 rounded-full flex items-center gap-12 border border-white/10 shadow-2xl pointer-events-auto"
      >
        {/* Logo */}
        <Link
          to="/"
          className="text-xl font-bold tracking-tighter text-white hover:text-accent transition-colors"
        >
          DIGITAL<span className="text-accent">CLOSET</span>
        </Link>

        {/* Center Links */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => {
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
                  "text-[10px] font-black uppercase tracking-[0.2em] transition-all relative py-1",
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

        {/* Auth Buttons */}
        <div className="flex items-center gap-4 border-l border-white/10 pl-8">
          {isAuthenticated ? (
            <div className="flex items-center gap-4">
              {/* Task 47: persona-type entry point - Attire (Task 40) no
                  longer points at /persona, so this is now the only
                  discoverable path back to the persona-type picker. A
                  small icon-button here rather than a new center nav item,
                  keeping Attire/Closet/Outfits as the only primary links. */}
              <Link
                to="/persona"
                className="p-2 rounded-full hover:bg-white/5 text-text-secondary hover:text-white transition-all"
                title="Persona"
              >
                <UserCircle size={16} />
              </Link>
              <button
                onClick={logout}
                className="p-2 rounded-full hover:bg-white/5 text-text-secondary hover:text-white transition-all"
              >
                <LogOut size={16} />
              </button>
              <div className="w-7 h-7 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center text-accent text-[10px] font-black">
                {user?.email[0].toUpperCase()}
              </div>
            </div>
          ) : (
            <>
              <Link 
                to="/login" 
                className="text-[10px] font-black uppercase tracking-widest text-text-secondary hover:text-text-primary transition-colors"
              >
                Login
              </Link>
              <Link 
                to="/signup" 
                className="bg-accent hover:bg-accent-hover text-white px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all transform hover:scale-105 active:scale-95 shadow-lg shadow-accent/20"
              >
                Join
              </Link>
            </>
          )}
        </div>
      </motion.div>
    </nav>
  );
};

export default Navbar;
