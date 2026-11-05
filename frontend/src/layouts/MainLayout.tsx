import { Suspense } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import Navbar from '../components/Navbar';
import ErrorBoundary from '../components/ErrorBoundary';
import ErrorState from '../components/ErrorState';
import AdSlot from '../components/ads/AdSlot';
import ConsentBanner from '../components/ConsentBanner';
import { useConsentStore } from '../store/useConsentStore';
import { useAuthStore } from '../store/useAuthStore';

// The frame of every page: navbar on top, the routed page in the middle, footer below.
const MainLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const reopenConsent = useConsentStore((state) => state.reopen);

  return (
    <div className="min-h-dvh bg-background-main flex flex-col">
      <Navbar />
      <main className="flex-grow pt-[calc(5.5rem+env(safe-area-inset-top))] md:pt-24">
        {/* Task 22: a page that crashes while rendering shows a recoverable
            error instead of a blank screen, and the navbar keeps working. It
            resets when the route changes, so leaving a crashed page never
            leaves the error stuck on the next one. */}
        <ErrorBoundary
          resetKeys={[location.pathname]}
          fallback={({ reset }) => (
            <ErrorState
              title="This page ran into a problem"
              message="Something went wrong while showing this page. You can try again, or head back home."
              onRetry={reset}
              secondaryLabel="Go home"
              onSecondary={() => navigate(isAuthenticated ? '/showcase' : '/')}
            />
          )}
        >
          {/* Task 100: pages are loaded on demand; a spinner shows while a page's code arrives, and a
              chunk that fails to load lands in the error state above like any other render error. */}
          <Suspense
            fallback={
              <div className="flex justify-center py-32" role="status" aria-label="Loading">
                <Loader2 className="animate-spin text-accent" size={28} />
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>

      {/* Task 97: the app's one ad slot - free accounts only, nothing when no ad network is set up. */}
      <AdSlot />

      <footer className="py-12 border-t border-ink/5 text-center text-text-secondary text-sm space-y-4">
        {/* Task 99: legal pages and the way back to the cookie choice. */}
        <nav aria-label="Legal" className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[10px] uppercase tracking-widest">
          <Link to="/privacy" className="hover:text-text-primary transition-colors">Privacy</Link>
          <Link to="/terms" className="hover:text-text-primary transition-colors">Terms</Link>
          <button type="button" onClick={reopenConsent} className="uppercase tracking-widest hover:text-text-primary transition-colors">
            Cookie settings
          </button>
        </nav>
        <p>© 2026 VYSVI. DESIGNED FOR THE FUTURE OF FASHION.</p>
      </footer>

      <ConsentBanner />
    </div>
  );
};

export default MainLayout;
