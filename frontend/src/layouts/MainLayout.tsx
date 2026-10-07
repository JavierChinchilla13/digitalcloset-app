import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import ErrorBoundary from '../components/ErrorBoundary';
import ErrorState from '../components/ErrorState';
import AdSlot from '../components/ads/AdSlot';
import { useAuthStore } from '../store/useAuthStore';

// The frame of every page: navbar on top, the routed page in the middle, footer below.
const MainLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

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
          <Outlet />
        </ErrorBoundary>
      </main>

      {/* Task 97: the app's one ad slot - free accounts only, nothing when no ad network is set up. */}
      <AdSlot />

      <footer className="py-12 border-t border-ink/5 text-center text-text-secondary text-sm">
        <p>© 2026 VYSVI. DESIGNED FOR THE FUTURE OF FASHION.</p>
      </footer>
    </div>
  );
};

export default MainLayout;
